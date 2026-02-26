/**
 * Update Notification Component
 * Shows a banner when a new version is available
 */
import { reloadPage } from '../utils/versionCheck.js';

let notificationElement = null;

/**
 * Initialize the update notification system
 */
export function initUpdateNotification() {
    // Check if update notification already exists
    if (document.getElementById('update-notification')) return;
    
    // Create notification element
    notificationElement = document.createElement('div');
    notificationElement.id = 'update-notification';
    notificationElement.className = 'update-notification';
    notificationElement.style.display = 'none';
    notificationElement.innerHTML = `
        <div class="update-content">
            <span class="update-icon">\ud83d\ude80</span>
            <span class="update-text">New version available!</span>
            <button class="update-btn" id="update-now-btn">Update Now</button>
            <button class="update-close" id="update-dismiss-btn">\u00d7</button>
        </div>
    `;
    
    document.body.appendChild(notificationElement);
    
    // Add event listeners
    document.getElementById('update-now-btn').addEventListener('click', () => {
        reloadPage();
    });
    
    document.getElementById('update-dismiss-btn').addEventListener('click', () => {
        hideUpdateNotification();
    });
}

/**
 * Show update notification
 */
export function showUpdateNotification(newVersion, currentVersion) {
    if (!notificationElement) {
        initUpdateNotification();
    }
    
    const textEl = notificationElement.querySelector('.update-text');
    if (textEl && newVersion && currentVersion) {
        textEl.textContent = `Update available: v${currentVersion} \u2192 v${newVersion}`;
    }
    
    notificationElement.style.display = 'block';
    
    // Auto-hide after 30 seconds if not clicked
    setTimeout(() => {
        hideUpdateNotification();
    }, 30000);
}

/**
 * Hide update notification
 */
export function hideUpdateNotification() {
    if (notificationElement) {
        notificationElement.style.display = 'none';
    }
}

/**
 * Add update notification styles
 */
export function addUpdateNotificationStyles() {
    if (document.getElementById('update-notification-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'update-notification-styles';
    styles.textContent = `
        .update-notification {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 10000;
            background: linear-gradient(90deg, #059669, #10b981);
            color: white;
            padding: 12px 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideDown 0.3s ease;
        }
        
        @keyframes slideDown {
            from { transform: translateY(-100%); }
            to { transform: translateY(0); }
        }
        
        .update-content {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .update-icon {
            font-size: 20px;
        }
        
        .update-text {
            font-weight: 500;
            font-size: 14px;
        }
        
        .update-btn {
            background: white;
            color: #059669;
            border: none;
            padding: 6px 16px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .update-btn:hover {
            background: #f0fdf4;
            transform: scale(1.05);
        }
        
        .update-close {
            background: none;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
            padding: 0 4px;
            margin-left: 8px;
            opacity: 0.8;
            transition: opacity 0.2s;
        }
        
        .update-close:hover {
            opacity: 1;
        }
        
        @media (max-width: 480px) {
            .update-content {
                flex-wrap: wrap;
                gap: 8px;
            }
            
            .update-text {
                font-size: 13px;
            }
        }
    `;
    
    document.head.appendChild(styles);
}
