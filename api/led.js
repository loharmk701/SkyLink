let state = globalThis.__agrosmartLedState;

if (!state) {
  state = { on: false };
  globalThis.__agrosmartLedState = state;
}

function cors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Cache-Control", "no-store");
}

export default function handler(request, response) {
  cors(response);

  if (request.method === "OPTIONS") {
    return response.status(204).end();
  }

  if (request.method === "GET") {
    return response.status(200).json({ on: state.on, pin: "D10" });
  }

  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }

  const requestedState = request.body?.on;
  if (typeof requestedState !== "boolean") {
    return response.status(400).json({ error: "on must be boolean" });
  }

  state.on = requestedState;
  return response.status(200).json({ on: state.on, pin: "D10" });
}
