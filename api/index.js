import server from "../dist/server/server.js";

export default async function handler(req, res) {
  const protocol = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const url = `${protocol}://${host}${req.url}`;

  let body = null;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await new Promise((resolve) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks)));
    });
  }

  const headers = {};
  for (const [key, val] of Object.entries(req.headers)) {
    if (val !== undefined) {
      headers[key] = Array.isArray(val) ? val.join(", ") : val;
    }
  }

  const requestInit = {
    method: req.method,
    headers: headers,
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    requestInit.body = body;
  }

  try {
    const webRequest = new Request(url, requestInit);
    const webResponse = await server.fetch(webRequest);

    res.statusCode = webResponse.status;
    res.statusMessage = webResponse.statusText;

    webResponse.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (webResponse.body) {
      const reader = webResponse.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    console.error("Error in serverless handler:", err);
    res.statusCode = 500;
    res.end("Internal Server Error");
  }
}
