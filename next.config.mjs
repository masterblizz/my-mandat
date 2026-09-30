/** @type {import('next').NextConfig} */
const nextConfig = {
  // The web deployment retains its server routes. The Android wrapper uses
  // CAPACITOR_BUILD=1 to produce a self-contained static game bundle.
  ...(process.env.CAPACITOR_BUILD === "1" ? {
    output: "export",
    images: { unoptimized: true },
  } : {}),
};

export default nextConfig;
