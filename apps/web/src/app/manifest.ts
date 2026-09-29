import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "On-Time",
    short_name: "On-Time",
    description: "On Time all the time",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F4F4F5",
    theme_color: "#09090B",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
