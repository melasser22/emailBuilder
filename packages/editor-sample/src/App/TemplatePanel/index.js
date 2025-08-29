import React, { useEffect, useRef } from 'react';
import { MonitorOutlined, PhoneIphoneOutlined } from '@mui/icons-material';
import { Box, Stack, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import { Reader } from '@usewaypoint/email-builder';
import ReactDOMServer from "react-dom/server";
import EditorBlock from '../../documents/editor/EditorBlock';
import {
    setSelectedScreenSize,
    useDocument,
    useSelectedMainTab,
    useSelectedScreenSize,
    setDocument
} from '../../documents/editor/EditorContext';

import ToggleInspectorPanelButton from '../InspectorDrawer/ToggleInspectorPanelButton';
import ToggleSamplesPanelButton from '../SamplesDrawer/ToggleSamplesPanelButton';
import DownloadJson from './DownloadJson';
import HtmlPanel from './HtmlPanel';
import ImportJson from './ImportJson';
import JsonPanel from './JsonPanel';
import MainTabsGroup from './MainTabsGroup';
import ShareButton from './ShareButton';
import { importFromHtml } from './helper/ImportFromHTML';
import { getNewInstanceId,releaseInstanceId  } from "./helper/instanceTracker";


// GLOBAL SINGLETON MANAGEMENT - Only allow ONE instance
let GLOBAL_INSTANCE_ID = null;
let INSTANCE_COUNTER = 0;

// Authentication state management
// TODO: Remove temporary auth bypass when real authentication is available
let authenticationState = {
    // Default to authenticated so the editor renders without handshake
    isAuthenticated: true,
    userData: null,
    token: null,
    userId: null,
    tenantId: null,
    sessionId: null,
    isAuthenticating: false,
    // Mark auth check complete to skip access-denied flow
    hasChecked: true
};

// Debug function
// const showDebugInfo = (message, instanceId) => {
//     console.log(`🔍 [DEBUG][${instanceId}] ${message}`);
// };

// Access denied screen management
const showAccessDeniedScreen = (errorMessage = 'Access Denied', instanceId) => {
    //showDebugInfo(`Showing access denied: ${errorMessage}`, instanceId);
    
    const mainContent = document.getElementById('email-builder-main');
    if (mainContent) {
        mainContent.style.display = 'none';
    }

    const existingScreen = document.getElementById('access-denied-screen');
    if (existingScreen) {
        existingScreen.remove();
    }

    const accessDeniedHTML = `
        <div id="access-denied-screen" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #f8f9fa;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Arial, sans-serif;
            z-index: 9999;
        ">
            <div style="
                text-align: center;
                padding: 40px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                max-width: 500px;
            ">
                <div style="
                    width: 80px;
                    height: 80px;
                    margin: 0 auto 20px;
                    background: #dc3545;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 32px;
                ">🔒</div>
                <h2 style="color: #dc3545; margin-bottom: 16px;">Access Denied</h2>
                <p style="color: #6c757d; margin-bottom: 24px;">${errorMessage}</p>
                <p style="color: #6c757d; font-size: 14px;">
                    Please contact your administrator or try refreshing the page.
                </p>
                <button onclick="window.location.reload()" style="
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-top: 16px;
                ">Refresh Page</button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', accessDeniedHTML);
};

const hideAccessDeniedScreen = (instanceId) => {
   // showDebugInfo('Hiding access denied screen', instanceId);
    const screen = document.getElementById('access-denied-screen');
    if (screen) {
        screen.remove();
    }

    const mainContent = document.getElementById('email-builder-main');
    if (mainContent) {
        mainContent.style.display = 'block';
    }
};
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}
const initialAuthState = {
  userId: getQueryParam("userId") || "",
  userName: getQueryParam("userName") || "",
  userEmail: getQueryParam("userEmail") || "",
  tenantId: getQueryParam("tenantId") || "",
  tenantName: getQueryParam("tenantName") || "",
  otpReference: getQueryParam("otpReference") || "",
  otpValidationStatus: getQueryParam("otpValidationStatus") || "",
  otpVerified: getQueryParam("otpVerified") || "",
  sessionId: getQueryParam("sessionId") || "",
};
// Extract user data from URL parameters
const extractUserDataFromUrl = (instanceId) => {
    //showDebugInfo('Extracting user data from URL', instanceId);
    const urlParams = new URLSearchParams(window.location.search);
    
    return {
        token: urlParams.get('token'),
        userId: urlParams.get('userId'),
        userName: urlParams.get('userName'),
        userEmail: urlParams.get('userEmail'),
        tenantId: urlParams.get('tenantId'),
        tenantName: urlParams.get('tenantName'),
        otpReference: urlParams.get('otpReference'),
        otpValidationStatus: urlParams.get('otpValidationStatus'),
        otpVerified: urlParams.get('otpVerified'),
        permissions: urlParams.get('permissions')?.split(',') || [],
        sessionId: urlParams.get('sessionId')
    };
};

// Token validation with parent
const validateTokenWithParent = (token, instanceId) => {
   // showDebugInfo('Starting token validation with parent', instanceId);
    return new Promise((resolve, reject) => {
        const requestId = Date.now().toString();

        window.parent.postMessage({
            type: 'VALIDATE_TOKEN',
            payload: { token: token, requestId: requestId }
        }, '*');
        
        const messageHandler = (event) => {
            if (event.data.type === 'TOKEN_VALIDATION_RESULT' &&
                event.data.requestId === requestId) {

                window.removeEventListener('message', messageHandler);

                if (event.data.isValid) {
                    resolve(event.data.userData);
                } else {
                    reject(new Error(event.data.error || 'Authentication failed'));
                }
            }
        };

        window.addEventListener('message', messageHandler);

        setTimeout(() => {
            window.removeEventListener('message', messageHandler);
            reject(new Error('Authentication timeout - please refresh the page'));
        }, 10000);
    });
};

// Initialize authentication
const initializeAuthentication = async (instanceId) => {
    if (authenticationState.hasChecked) return authenticationState.isAuthenticated;
    if (authenticationState.isAuthenticating) return false;

    authenticationState.isAuthenticating = true;
    
    const urlUserData = extractUserDataFromUrl(instanceId);

    if (!urlUserData.token || !urlUserData.userId || !urlUserData.tenantId) {
        authenticationState = { ...authenticationState, isAuthenticating: false, hasChecked: true, isAuthenticated: false };
        showAccessDeniedScreen('No authentication token provided', instanceId);
        return false;
    }

    try {
        const userData = await validateTokenWithParent(urlUserData.token, instanceId);

        authenticationState = {
            isAuthenticated: true,
            userData: userData,
            token: urlUserData.token,
            userId: urlUserData.userId,
            userName: urlUserData.userName,
            userEmail: urlUserData.userEmail,
            tenantId: urlUserData.tenantId,
            tenantName: urlUserData.tenantName,
            sessionId: urlUserData.sessionId,
            isAuthenticating: false,
            hasChecked: true
        };

        hideAccessDeniedScreen(instanceId);
        return true;

    } catch (error) {
        authenticationState = { ...authenticationState, isAuthenticating: false, hasChecked: true, isAuthenticated: false };
        
        let errorMessage = 'You do not have permission to access this application';
        if (error.message.includes('timeout')) errorMessage = 'Authentication timeout. Please try again.';
        else if (error.message.includes('Invalid token') || error.message.includes('expired')) errorMessage = 'Your session has expired. Please login again.';
        
        showAccessDeniedScreen(errorMessage, instanceId);
        return false;
    }
};

// Create empty template helper
const createEmptyTemplate = () => ({
    root: {
        type: 'EmailLayout',
        data: {
            backdropColor: '#FFFFFF',
            canvasColor: '#FFFFFF',
            textColor: '#333333',
            fontFamily: 'GEOMETRIC_SANS',
            childrenIds: [],
        },
    },
});

export default function TemplatePanel() {
   // STRICT SINGLETON - Safe for StrictMode
const urlUserData = extractUserDataFromUrl();
const currentInstanceId = getNewInstanceId(urlUserData.userId, urlUserData.tenantId);

if (process.env.NODE_ENV === "production") {
  // In production → block duplicates
  if (GLOBAL_INSTANCE_ID && GLOBAL_INSTANCE_ID !== currentInstanceId) {
    return null;
  }

  if (!GLOBAL_INSTANCE_ID) {
    GLOBAL_INSTANCE_ID = currentInstanceId;
  }
} else {
  // In development → always allow remount (StrictMode safe)
  GLOBAL_INSTANCE_ID = currentInstanceId;
}

    const document = useDocument();
    const selectedMainTab = useSelectedMainTab();
    const selectedScreenSize = useSelectedScreenSize();

    const latestDocumentRef = useRef(document);
    const componentId = `js-single-${currentInstanceId}`;

    useEffect(() => {
        latestDocumentRef.current = document;
    }, [document]);

    let mainBoxSx = { height: '100%' };
    if (selectedScreenSize === 'mobile') {
        mainBoxSx = { ...mainBoxSx, margin: '32px auto', width: 370, height: 800 };
    }

    const getFreshDocument = () => latestDocumentRef.current;

    const generateHtmlFromDocument = () => {
        const currentDocument = getFreshDocument();
        if (!currentDocument || !currentDocument.root) {
            return '<div style="padding: 20px; font-family: Arial, sans-serif;">Empty email template</div>';
        }
        try {
            return ReactDOMServer.renderToStaticMarkup(
                React.createElement(Reader, { document: currentDocument, rootBlockId: "root" })
            );
        } catch (error) {
            return `<div style="padding: 20px; color: red;">Error generating HTML: ${error.message}</div>`;
        }
    };

    const createCompleteHtmlDocument = (bodyHtml) => `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin: 0; padding: 0;">${bodyHtml}</body></html>`;

    useEffect(() => {
        const initAuth = async () => {
            // Skip authentication handshake in Docker environment
            // const authSuccess = await initializeAuthentication(currentInstanceId);
            // if (!authSuccess) return;

            const handleMessage = (event) => {
                if (!authenticationState.isAuthenticated) return;
                const { type, payload } = event.data || {};

                switch (type) {
                    case "LOAD_TEMPLATE":
                        try {
                            let templateToLoad;
                            if (payload?.method === "document" && payload?.document) {
                                templateToLoad = payload.document;
                            } else if (payload?.method === "json" && payload?.json) {
                                templateToLoad = payload.json;
                            } else if (payload?.method === "html" && payload?.html) {
                                try {
                                    templateToLoad = importFromHtml(payload.html);
                                } catch {
                                    templateToLoad = createEmptyTemplate();
                                }
                            } else {
                                templateToLoad = createEmptyTemplate();
                            }
                            setDocument(templateToLoad);
                            setTimeout(() => {
                                if (window.parent && window.parent !== window) {
                                    window.parent.postMessage({
                                        type: "TEMPLATE_LOADED",
                                        payload: { success: true, templateName: payload?.templateName || 'Template' }
                                    }, "*");
                                }
                            }, 1000);
                        } catch (error) {
                            if (window.parent && window.parent !== window) {
                                window.parent.postMessage({
                                    type: "TEMPLATE_LOADED",
                                    payload: { success: false, error: error.message }
                                }, "*");
                            }
                        }
                        break;

                    case "REQUEST_SAVE":
                        setTimeout(() => {
                            try {
                                const currentDocument = getFreshDocument();
                                if (!currentDocument || !currentDocument.root) throw new Error("No document to save");

                                const bodyHtml = generateHtmlFromDocument();
                                const fullHtml = createCompleteHtmlDocument(bodyHtml);

                                if (window.parent && window.parent !== window) {
                                    window.parent.postMessage({
                                        type: "TEMPLATE_SAVED",
                                        payload: { html: fullHtml, document: currentDocument }
                                    }, "*");
                                }
                            } catch (error) {
                                if (window.parent && window.parent !== window) {
                                    window.parent.postMessage({
                                        type: "ERROR",
                                        payload: { message: error.message, type: "save_error" }
                                    }, "*");
                                }
                            }
                        }, 100);
                        break;

                    default:
                        break;
                }
            };

            window.addEventListener("message", handleMessage);

            setTimeout(() => {
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage({ type: "EDITOR_READY" }, "*");
                }
            }, 1000);

            return () => window.removeEventListener("message", handleMessage);
        };

        initAuth();

      return () => {
  //showDebugInfo(`🟢 Instance ${currentInstanceId} cleaning up`, currentInstanceId);
 // Release instance so counter resets to 0 on next mount
  if (urlUserData.userId && urlUserData.tenantId) {
    releaseInstanceId(urlUserData.userId, urlUserData.tenantId);
  }
  // In production: keep strict singleton (no accidental duplicate)
  if (process.env.NODE_ENV === "production") {
    if (GLOBAL_INSTANCE_ID === currentInstanceId) {
      GLOBAL_INSTANCE_ID = null;
      authenticationState = {
        isAuthenticated: false,
        userData: null,
        token: null,
        userId: null,
        tenantId: null,
        sessionId: null,
        isAuthenticating: false,
        hasChecked: false
      };
     // showDebugInfo("🔄 Singleton reset (production only)", currentInstanceId);
    }
  } else {
    // In development: always release the ID (to survive StrictMode double-mount)
    if (GLOBAL_INSTANCE_ID === currentInstanceId) {
      //showDebugInfo("♻️ Dev mode reset for StrictMode re-mount", currentInstanceId);
      GLOBAL_INSTANCE_ID = null;
    }
  }
};

    }, []); // StrictMode-safe: only runs once per mount cycle

    const handleScreenSizeChange = (_, value) => {
        setSelectedScreenSize(value === 'mobile' || value === 'desktop' ? value : 'desktop');
    };

    const renderMainPanel = () => {
        switch (selectedMainTab) {
            case 'editor': return React.createElement(Box, { id: 'email-builder-main', sx: mainBoxSx }, React.createElement(EditorBlock, { id: "root" }));
            case 'preview': return React.createElement(Box, { id: 'email-builder-main', sx: mainBoxSx }, React.createElement(Reader, { document, rootBlockId: "root" }));
            case 'html': return React.createElement(HtmlPanel, null);
            case 'json': return React.createElement(JsonPanel, null);
            default: return React.createElement(Box, { id: 'email-builder-main', sx: mainBoxSx }, React.createElement(EditorBlock, { id: "root" }));
        }
    };

    if (!authenticationState.isAuthenticated && authenticationState.hasChecked) return null;

    return React.createElement(React.Fragment, null,
        React.createElement(Stack, {
            sx: { height: 49, borderBottom: 1, borderColor: 'divider', backgroundColor: 'white', position: 'sticky', top: 0, zIndex: 'appBar', px: 1 },
            direction: "row", justifyContent: "space-between", alignItems: "center"
        },
            React.createElement(Stack, { px: 2, direction: "row", gap: 2, width: "100%", justifyContent: "space-between", alignItems: "center" },
                React.createElement(Stack, { direction: "row", spacing: 2 }, 
                    React.createElement(MainTabsGroup, null),
                    React.createElement(Box, { sx: { fontSize: '11px', color: 'green', display: 'flex', alignItems: 'center', fontFamily: 'monospace' } }, 
                        `✅ ${authenticationState.userName}@${authenticationState.tenantName} [${currentInstanceId}]`
                    )
                ),
                React.createElement(Stack, { direction: "row", spacing: 2 },
                    React.createElement(ToggleButtonGroup, {
                        value: selectedScreenSize, exclusive: true, size: "small", onChange: handleScreenSizeChange
                    },
                        React.createElement(ToggleButton, { value: "desktop" },
                            React.createElement(Tooltip, { title: "Desktop view" }, React.createElement(MonitorOutlined, { fontSize: "small" }))
                        ),
                        React.createElement(ToggleButton, { value: "mobile" },
                            React.createElement(Tooltip, { title: "Mobile view" }, React.createElement(PhoneIphoneOutlined, { fontSize: "small" }))
                        )
                    )
                )
            ),
            React.createElement(ToggleInspectorPanelButton, null)
        ),
        React.createElement(Box, { sx: { height: 'calc(100vh - 49px)', overflow: 'auto', minWidth: 370 } }, renderMainPanel())
    );
}
