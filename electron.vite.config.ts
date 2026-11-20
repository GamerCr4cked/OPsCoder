import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
const csp="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const cspPlugin:Plugin={name:"opscoder-csp",apply:"build",transformIndexHtml(html){return html.replace("</head>",`<meta http-equiv="Content-Security-Policy" content="${csp}"/></head>`);}};
export default defineConfig({ main: { plugins: [externalizeDepsPlugin()] }, preload: { plugins: [externalizeDepsPlugin()] }, renderer: { plugins: [react(),cspPlugin] } });
