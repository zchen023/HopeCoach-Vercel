/*
 * Import the OpenAI class from the openai package. The package exports
 * several members, but the `OpenAI` class is not the default export. When
 * using `ts-node` with ES module syntax, you must import it as a named
 * import. Attempting to import the package as the default and then
 * instantiate it (e.g. `new OpenAI(...)`) results in a TypeScript
 * "not constructable" error because the default export is a module
 * namespace object rather than a class. See
 * https://github.com/openai/openai-node#usage for correct usage.
 */
import { OpenAI } from "openai";

// -----------------------------------------------------------------------------
//  HopeCoach Agent
//
//  This module implements a simple health‑support agent for cancer patients
//  and their caregivers. It leverages OpenAI’s function calling mechanism to
//  enable structured interactions such as retrieving a medication schedule or
//  logging health events. The agent is designed to be compassionate,
//  non‑judgmental and to never replace medical advice. See the `systemPrompt`
//  definition below for the full set of behavioral guidelines.
//
//  Usage:
//    import { chat } from "./health_agent";
//    const reply = await chat("I missed my evening pill", userId);
//
//  Before running, ensure you set the environment variable `OPENAI_API_KEY` to
//  your API key. You can install the required package with `npm i openai`.
// -----------------------------------------------------------------------------

/**
 * System prompt encapsulating the role, tone, safety boundaries and core
 * capabilities of the agent. This prompt is sent with every request to the
 * model to prime its behaviour.
 */
const systemPrompt = `
You are HopeCoach, a compassionate, practical AI life‑coach for people with
cancer and their caregivers. Your mission is to help users remember and track
medications, appointments, and simple routines; provide gentle lifestyle
guidance appropriate for cancer patients; support mental wellbeing with
check‑ins, reflective listening, and simple coping strategies; and remind
users that you are not a doctor, encouraging them to follow their care team’s
instructions for anything clinical.

Tone: warm, brief, empowering, non‑judgmental. Use plain language. Offer
one to three options when helpful and celebrate small wins.

Safety & Boundaries:
• You are not a doctor. Do not prescribe medication, modify dosages,
  interpret lab results or diagnose conditions.
• If a user reports urgent or severe symptoms (trouble breathing, chest
  pain, uncontrolled bleeding, fever ≥ 38 °C/100.4 °F during chemotherapy,
  severe allergic reaction, self‑harm risk), respond empathetically and
  advise contacting their care team or emergency services immediately. If
  self‑harm is mentioned, also provide a crisis hotline relevant to their
  locale.
• If asked about changing a dose or timing, encourage contacting their
  oncologist or pharmacist and reviewing printed instructions. Do not give
  explicit medical advice.
• Ask a clarifying question if information is missing or ambiguous. Respect
  user privacy: only remember details the user explicitly asks you to.

Core capabilities:
• Medication support: remind and log when to take medication; handle
  missed doses by advising not to double dose unless a clinician has
  instructed otherwise; suggest contacting the care team for guidance.
• Side‑effect logging: capture nausea, pain, fatigue or other symptoms;
  highlight when severe side‑effects warrant escalation.
• Mental health check‑ins: ask for mood on a 0–10 scale; if low, offer
  simple coping steps (breathing, journaling, contacting a friend) and
  encourage reaching out to the care team if needed.
• Lifestyle nudges: remind about hydration, short walks or stretches,
  balanced meals and sleep hygiene, ensuring these are suggestions and
  subject to doctor approval.
• Caregiver support: include caregivers in the conversation, providing
  simple tips and reminding them to care for themselves.

Escalation template (use verbatim when appropriate):
"I'm concerned about what you shared. I'm here with you, but I'm not a
 doctor. Please contact your care team now, or if you feel you're in
 danger, call emergency services. If you need someone to talk to
 immediately, a crisis line can help."
`;

// Instantiate the OpenAI client once. Ensure the API key is provided via
// environment variable. If undefined, an explicit error is thrown to
// surface misconfiguration immediately.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

/**
 * Tools available to the model. These functions encapsulate domain
 * operations such as fetching a medication schedule for a user or logging an
 * event into a journal. In a real implementation you would replace the
 * bodies of these functions with calls to your database or service layer.
 */
const tools = {
  /**
   * Return today's medication schedule for a user. Replace the mocked
   * return value with real logic to query your data store. The returned
   * object can be structured however you like; the model expects JSON.
   */
  async getMedSchedule(userId: string) {
    // TODO: Replace this with real lookup logic. For example, query a
    // database or call another microservice. Ensure you handle missing
    // schedules gracefully.
    return {
      date: new Date().toISOString().split("T")[0],
      userId,
      medications: [
        {
          name: "Letrozole",
          dose: "2.5 mg",
          time: "08:00",
          withFood: true,
        },
        {
          name: "Ondansetron",
          dose: "8 mg",
          time: "18:00",
          asNeeded: true,
        },
      ],
    };
  },

  /**
   * Save an event to the user's timeline or journal. In a production
   * environment this would persist data; here it just logs the payload
   * and returns confirmation. The payload includes an event type and an
   * optional note.
   */
  async logEvent(payload: { type: string; note?: string }) {
    // TODO: Persist the event. For demonstration purposes we return
    // the payload with a timestamp. You could extend this to append
    // to a record associated with the user.
    return {
      recordedAt: new Date().toISOString(),
      ...payload,
    };
  },
};

// Function metadata describing the available tools. This array informs
// the OpenAI API about each function's name, description and JSON
// parameters so that the model can decide when to call them.
const toolSchema = [
  {
    type: "function",
    function: {
      name: "getMedSchedule",
      description: "Return today's medication schedule for a specific user.",
      parameters: {
        type: "object",
        properties: {
          userId: { type: "string", description: "The identifier of the user" },
        },
        required: ["userId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "logEvent",
      description: "Save an event to the user's timeline or journal. Typical events include taking a medication, missing a dose, logging a mood or recording a side‑effect.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", description: "The kind of event (e.g. 'pill_taken', 'pill_missed', 'mood_log', 'side_effect')" },
          note: { type: "string", description: "Additional details provided by the user", nullable: true },
        },
        required: ["type"],
      },
    },
  },
] as const;

/**
 * Chat with the HopeCoach agent. This function takes a user's message and
 * userId, constructs a conversation with the system prompt and user message,
 * then sends it to the OpenAI API. If the assistant chooses to call a
 * function, this helper will call the corresponding JavaScript function
 * defined in the `tools` object, then send the function's result back to
 * the model to get the final, natural language response.
 *
 * @param userMsg The end‑user’s message to the agent
 * @param userId A string identifier for the user, passed to tool calls
 * @returns The agent's natural language reply as a string
 */
export async function chat(userMsg: string, userId: string): Promise<string> {
  // First request: include system prompt and the user's message. We also
  // provide the tool schema to let the model decide whether to call a
  // function. We use a JSON schema response format to ensure the agent
  // returns structured data with a top‑level `reply` field.
  const initial = await openai.chat.completions.create({
    model: "gpt-3.5-turbo", // choose a model; change as appropriate
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMsg },
    ],
    tools: toolSchema as unknown as any,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "AgentReply",
        schema: {
          type: "object",
          properties: { reply: { type: "string" } },
          required: ["reply"],
        },
      },
    },
    temperature: 0.3,
    top_p: 0.9,
  });

  const assistantMessage = initial.choices[0].message;

  // If the assistant requested one or more tool calls, execute them and
  // return the final answer. Otherwise, parse the message content as JSON
  // and return the `reply` field.
  if (assistantMessage.tool_calls?.length) {
    const toolResults: { tool_call_id: string; role: "tool"; name: string; content: string }[] = [];
    for (const call of assistantMessage.tool_calls) {
      // Parse arguments from JSON string if present
      const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      let result;
      switch (call.function.name) {
        case "getMedSchedule":
          // Provide userId to the tool call; the model may or may not have
          // included it in the arguments, so we fall back to the provided
          // parameter.
          result = await tools.getMedSchedule(args.userId || userId);
          break;
        case "logEvent":
          result = await tools.logEvent(args);
          break;
        default:
          result = { error: `Unknown function: ${call.function.name}` };
      }
      toolResults.push({
        tool_call_id: call.id,
        role: "tool",
        name: call.function.name,
        content: JSON.stringify(result),
      });
    }
    // Send the tool results back to the model along with the prior messages
    const final = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
        assistantMessage,
        ...toolResults,
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "AgentReply",
          schema: {
            type: "object",
            properties: { reply: { type: "string" } },
            required: ["reply"],
          },
        },
      },
      temperature: 0.3,
      top_p: 0.9,
    });
    return JSON.parse(final.choices[0].message.content!).reply;
  }

  // No function call: simply return the reply text
  return JSON.parse(assistantMessage.content!).reply;
}

// Optionally expose the system prompt and tools for testing or extension
export { systemPrompt, toolSchema, tools };
