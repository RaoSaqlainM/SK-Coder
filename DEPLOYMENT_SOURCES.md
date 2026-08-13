# Deployment Research Sources

## Oracle Cloud Infrastructure Security Rules

Source: https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securityrules.htm

Oracle documents security lists and network security groups as the virtual firewall mechanisms for compute VNIC traffic. The documentation recommends network security groups for component-specific security postures, and notes that operating-system firewall rules must align with the selected OCI security rules. The deployment guide should therefore open only TCP 22, 80, and 443, keep the backend’s internal port private, and configure both the OCI network control and the VM firewall.

## Oracle Cloud Instance Access

Source: https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/accessinginstance.htm

Oracle documents SSH as the standard method for connecting to a running Linux compute instance.

## Vite on Vercel

Source: https://vercel.com/docs/frameworks/frontend/vite

Vercel documents that Vite builds optimized static assets and that single-page applications need a root rewrite to `index.html` for deep linking. Variables intended for Vite client builds must use the `VITE_` prefix.

## Vercel Rewrites

Source: https://vercel.com/docs/routing/rewrites

Vercel documents external-origin rewrites for proxying API requests without changing the browser URL. The guide warns that upstream cache headers can be honored, so mutable execution and storage endpoints should explicitly disable rewrite caching.
