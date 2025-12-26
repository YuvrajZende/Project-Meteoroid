/**
 * Integration Services
 * Third-party integrations: GitHub, deployment, preview
 */

export {
    DeploymentService,
    getDeploymentService,
    type DeploymentProvider,
    type DeploymentStatus,
} from './deployment-service.js';

export {
    GitHubService,
    getGitHubService,
} from './github-service.js';

export {
    PreviewService,
    getPreviewService,
    type PreviewRequest,
    type PreviewFile,
    type HMRUpdate,
    type PreviewResult,
    type PreviewSession,
    type PreviewFramework,
} from './preview-service.js';

export {
    AutoDeployManager,
    getAutoDeployManager,
} from './auto-deploy-manager.js';

// Connection Manager - export from root connection-manager folder
export * from '../connection-manager/index.js';
