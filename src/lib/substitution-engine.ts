import type { TemplateSection, GeneratedConfigOutput, GeneratedSection } from '../types/index.ts';

/**
 * Replace $variable and ${variable} placeholders in text with values.
 * Only replaces when the char after $ is a letter or underscore.
 * Leaves placeholders as-is when value is missing or empty string.
 * Greedy on word chars to match longest variable name first.
 */
function substituteVariables(text: string, values: Record<string, string>): string {
  // Handle ${variable} syntax
  let result = text.replace(/\$\{([a-zA-Z_]\w*)\}/g, (match, name) => {
    const value = values[name];
    if (value === undefined || value === '') return match;
    return value;
  });

  // Handle $variable syntax — only when $ is followed by a letter or underscore
  // Uses greedy \w* to match the longest possible variable name
  result = result.replace(/\$([a-zA-Z_]\w*)/g, (match, name) => {
    const value = values[name];
    if (value === undefined || value === '') return match;
    return value;
  });

  return result;
}

/**
 * Generate a full config by applying variable substitutions to template sections.
 */
export function generateConfig(
  sections: TemplateSection[],
  values: Record<string, string>,
): GeneratedConfigOutput {
  if (sections.length === 0) {
    return { fullConfig: '', sections: [] };
  }

  const generatedSections: GeneratedSection[] = sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((section) => ({
      name: section.name,
      content: substituteVariables(section.template, values),
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
