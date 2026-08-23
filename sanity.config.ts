import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { apiVersion, dataset, projectId } from "./src/sanity/env";
import { schema } from "./src/sanity/schemaTypes";

export default defineConfig({
  basePath: "/studio",
  name: "tsg-website",
  title: "The Smart Generation — CMS",

  projectId,
  dataset,

  schema,

  plugins: [
    structureTool(),
    // Vision lets admins run raw GROQ queries — useful for debugging,
    // safe to keep since it requires being logged in as an editor.
    visionTool({ defaultApiVersion: apiVersion }),
  ],
});
