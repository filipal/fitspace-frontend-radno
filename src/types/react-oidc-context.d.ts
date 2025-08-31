// Proper module augmentation: import the module first so TypeScript merges declarations
import 'react-oidc-context'

declare module 'react-oidc-context' {
  // Augment the exported AuthContextProps interface with the missing method used in the app.
  interface AuthContextProps {
    /**
     * Called to process the signin redirect callback (e.g. when the OIDC provider redirects back with code/error).
     * Return type is Promise<void> to match async processing.
     */
    signinRedirectCallback(): Promise<void>
  }
}
