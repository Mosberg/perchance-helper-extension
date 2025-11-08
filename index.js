import { Server } from "@modelcontextprotocol/sdk/server/index.js";

const server = new Server(
  {
    name: "perchance-helper",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// Tool definitions (handled in list handler)
server.setRequestHandler("tools/list", async () => {
  return {
    tools: [
      {
        name: "validate_perchance_code",
        description: "Validate the syntax of Perchance code",
        inputSchema: {
          type: "object",
          properties: {
            code: { type: "string", description: "Perchance code to validate" },
          },
          required: ["code"],
        },
      },
      {
        name: "generate_random_output",
        description: "Generate a random output from Perchance code",
        inputSchema: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "Perchance code containing HTML and lists",
            },
          },
          required: ["code"],
        },
      },
    ],
  };
});

// Tool handlers
server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "validate_perchance_code") {
    // Basic validation: check for bracket syntax and lists
    const hasBrackets = /\[[\w]+\]/g.test(args.code);
    const hasLists = /\n\w+\n\s+(.*?)\n/g.test(args.code);
    const isValid = hasLists && (hasBrackets || !hasBrackets); // rough
    return {
      content: [
        {
          type: "text",
          text: isValid
            ? "Code appears valid"
            : "Code may have syntax errors. Ensure proper list definitions and placeholder brackets.",
        },
      ],
    };
  }

  if (name === "generate_random_output") {
    // Parse lists (listname\noption1|option2\option3)
    const lines = args.code.split("\n").map((l) => l.trim());
    const lists = {};
    let currentList = null;

    for (const line of lines) {
      if (
        !line.includes("|") &&
        line &&
        !line.startsWith("<") &&
        !line.includes("[")
      ) {
        currentList = line;
        lists[currentList] = [];
      } else if (
        line &&
        currentList &&
        !line.startsWith("<") &&
        !line.includes("[")
      ) {
        const options = line.split("|").map((o) => o.trim());
        lists[currentList].push(...options);
      }
    }

    // For HTML output, assume the first line is HTML
    let output = lines[0] || args.code; // if no HTML, use whole

    // Replace placeholders
    for (const [listName, options] of Object.entries(lists)) {
      const randomOption =
        options[Math.floor(Math.random() * options.length)] || "";
      output = output.replace(
        new RegExp(`\\[${listName}\\]`, "g"),
        randomOption
      );
    }

    // If no replacements, output "generating"

    return {
      content: [
        {
          type: "text",
          text: "Random output: " + output,
        },
      ],
    };
  }

  return { content: [] };
});

// Resources
server.setRequestHandler("resources/list", async () => {
  return {
    resources: [
      {
        uri: "perchance://examples/basic",
        mimeType: "text/plain",
        description: "Basic Perchance example with lists and HTML",
      },
    ],
  };
});

server.setRequestHandler("resources/read", async (request) => {
  if (request.params.uri === "perchance://examples/basic") {
    return {
      contents: [
        {
          uri: "perchance://examples/basic",
          mimeType: "text/plain",
          text: `<p>A [creature] that is [size] and loves [food]< /p>

creature
dog|cat|bird

size
small|large|medium

food
pizza|burgers|salad`,
        },
      ],
    };
  }
  return { contents: [] };
});

// Prompts
server.setRequestHandler("prompts/list", async () => {
  return {
    prompts: [
      {
        name: "create_perchance_list",
        description: "Prompt to help create a Perchance list",
        arguments: [
          {
            name: "topic",
            description: "The topic for the new list",
            required: true,
          },
        ],
      },
    ],
  };
});

server.setRequestHandler("prompts/get", async (request) => {
  const { name, arguments: args } = request.params;
  if (name === "create_perchance_list") {
    return {
      description: `Creating a Perchance list for ${args.topic}`,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Create a Perchance.org list for ${args.topic}. Kindly include several lists, an HTML template using placeholders, and explain the structure.`,
          },
        },
      ],
    };
  }
  return { messages: [] };
});

// Initialize the server
const runServer = async () => {
  try {
    process.stdout.write = process.stdout.write.bind(process.stdout);
    process.stdin.setEncoding("utf8");
    await server.connect(process.stdin, process.stdout);
  } catch (error) {
    console.error("Server connect error:", error);
    process.exit(1);
  }
};

runServer();
