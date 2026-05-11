// React-three-fiber JSX intrinsic elements augmentation.
// React 19 redirects JSX.IntrinsicElements lookups to React.JSX.IntrinsicElements.
// R3F 8 only augments the global JSX namespace, so we mirror it onto React.JSX.
import type { ThreeElements } from "@react-three/fiber";

declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

export {};
