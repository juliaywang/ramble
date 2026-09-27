import fs from "node:fs";
import path from "node:path";

const apiKey = process.env.TAVILY_API_KEY;
if (!apiKey) {
  console.error("Error: TAVILY_API_KEY is not set in .env");
  process.exit(1);
}

const query = process.argv.slice(2).join(" ") || "independent bookstores and neighborhood cafes in New York City";
console.log(`Searching Tavily for: "${query}"...`);

try {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",
      include_answer: true,
      max_results: 8,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavily API responded with status ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const outDir = path.resolve("src/pipeline/raw");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, "live-discoveries.json");
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));

  console.log(`\nSuccessfully fetched ${data.results?.length ?? 0} results from Tavily!`);
  console.log(`Saved JSON to: ${outPath}\n`);
  if (data.answer) {
    console.log("Summary:\n" + data.answer + "\n");
  }
  console.log("Places discovered:");
  data.results?.forEach((r, i) => console.log(` ${i + 1}. ${r.title}\n    ${r.url}`));
} catch (err) {
  console.error("Failed to fetch live discoveries:", err.message);
  process.exit(1);
}
