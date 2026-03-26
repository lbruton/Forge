import type { TemplateSection, GeneratedConfigOutput, GeneratedSection } from '../types/index.ts';

// Sentinel markers to wrap substituted variable values for highlighting.
// Using Unicode private-use-area chars that won't appear in config text.
export const SUB_START = '\uE000';
export const SUB_END = '\uE001';

/**
 * Replace $variable and ${variable} placeholders in text with values.
 * Only replaces when the char after $ is a letter or underscore.
 * Leaves placeholders as-is when value is missing or empty string.
 * Greedy on word chars to match longest variable name first.
 * Wraps substituted values with sentinel markers for downstream highlighting.
 */
function substituteVariables(
  text: string,
  localValues: Record<string, string>,
  globalValues: Record<string, string> = {},
): string {
  // Pass 1: resolve ${variable} from globalValues first, then fall back to localValues
  let result = text.replace(/\$\{([a-zA-Z_]\w*)\}/g, (match, name) => {
    const globalVal = globalValues[name];
    if (globalVal !== undefined && globalVal !== '') return `${SUB_START}${globalVal}${SUB_END}`;
    const localVal = localValues[name];
    if (localVal !== undefined && localVal !== '') return `${SUB_START}${localVal}${SUB_END}`;
    return match;
  });

  // Pass 2: resolve $variable from localValues (existing behavior)
  result = result.replace(/\$([a-zA-Z_]\w*)/g, (match, name) => {
    const value = localValues[name];
    if (value === undefined || value === '') return match;
    return `${SUB_START}${value}${SUB_END}`;
  });

  return result;
}

/**
 * Strip sentinel markers from text (for copy/download/display of raw config).
 */
export function stripSubMarkers(text: string): string {
  return text.replaceAll(SUB_START, '').replaceAll(SUB_END, '');
}

/**
 * Generate a full config by applying variable substitutions to template sections.
 */
export function generateConfig(
  sections: TemplateSection[],
  values: Record<string, string>,
  globalValues: Record<string, string> = {},
): GeneratedConfigOutput {
  if (sections.length === 0) {
    return { fullConfig: '', sections: [] };
  }

  const generatedSections: GeneratedSection[] = sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((section) => ({
      name: section.name,
      content: substituteVariables(section.template, values, globalValues),
      divider: section.dividerPattern,
      endDivider: section.endDividerPattern,
    }));

  const fullConfig = generatedSections
    .map((section, index) => {
      const parts: string[] = [];
      // Add START divider (for index > 0, or for START/END sections at index 0)
      if (section.divider) {
        if (index > 0 || section.endDivider) {
          parts.push(section.divider);
        }
      }
      // Add content
      parts.push(section.content);
      // Add END divider if present (START/END mode)
      if (section.endDivider) {
        parts.push(section.endDivider);
      }
      return parts.join('\n');
    })
    .join('\n');

  return { fullConfig, sections: generatedSections };
}
