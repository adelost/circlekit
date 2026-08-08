import {
  PORTABLE_SURFACE_CLASSES,
  defineScreenComponentFamilyRegistry,
} from "@v1d/product-spec";
import { showcaseCases, showcaseSections } from "./catalog.js";
import { showcaseComponentInstances } from "./graph-components.js";

export const SHOWCASE_SECTION_SCREENS = showcaseSections.map(({ id }) => `section.${id}`);

export const showcaseComponentFamilies = defineScreenComponentFamilyRegistry(
  showcaseComponentInstances,
  [
    ...showcaseSections.map((section) => ({
      screen: `section.${section.id}`,
      family: {
        id: `showcase.${section.id}`,
        trees: PORTABLE_SURFACE_CLASSES.map((surface) => ({
          surface,
          mounts: showcaseCases
            .filter(({ section: candidate }) => candidate === section.id)
            .map(({ id }) => ({
              instance: id,
              region: surface === "round" ? "face" : "content",
            })),
        })),
      },
    })),
    {
      screen: "artifact.garmin-limited-ui",
      family: {
        id: "showcase.garmin-limited-ui",
        trees: PORTABLE_SURFACE_CLASSES.map((surface) => ({
          surface,
          mounts: [{
            instance: "control.progress",
            region: surface === "round" ? "face" : "content",
          }],
        })),
      },
    },
  ],
);
