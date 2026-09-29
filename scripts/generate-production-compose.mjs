import { readFileSync, writeFileSync } from "node:fs";

let compose = readFileSync("compose.production.yml", "utf8");

// 1. Replace external secrets with file mounts
compose = compose.replace(/([a-z0-9_]+):\s*\{\s*external:\s*true\s*\}/g, (match, name) => {
  return `${name}:\n    file: ./secrets/${name}`;
});

// 2. Adjust resource limits for 1-CPU Oracle Always Free VM
compose = compose.replace(/cpus:\s*"2"/g, 'cpus: "1"');

// 3. Add Caddy network integration to web service
compose = compose.replace(
  /web:\s*\n\s*build:/,
  `web:\n    container_name: ontime-web\n    networks: [default, caddy_net]\n    build:`
);

// 4. Add caddy_net definition
compose += `
networks:
  caddy_net:
    external: true
    name: three-dollar-motel_default
`;

writeFileSync("compose.yml", compose, "utf8");
console.log("Generated production compose.yml with 1 CPU limits and concrete secrets.");
