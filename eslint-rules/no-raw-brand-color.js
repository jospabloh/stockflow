// ESLint rule: disallow raw indigo/cyan Tailwind utility classes in string literals.
// Use brand/accent design tokens instead (e.g. brand-500, accent-300).

const re = /\b(indigo|cyan)-[0-9]{2,3}\b/;

export const noRawBrandColor = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow raw indigo/cyan utility classes; use brand/accent tokens.",
    },
    schema: [],
  },
  create(context) {
    const check = (node, value) => {
      if (typeof value === "string" && re.test(value)) {
        context.report({
          node,
          message:
            "Use the brand/accent token (e.g. brand-500) instead of raw indigo/cyan utility classes.",
        });
      }
    };
    return {
      Literal(node) {
        check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.raw);
      },
    };
  },
};

export default {
  rules: {
    "no-raw-brand-color": noRawBrandColor,
  },
};
