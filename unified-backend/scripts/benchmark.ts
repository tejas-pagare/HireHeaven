import axios from 'axios';

// Minimal valid PDF encoded in Base64 (contains "Hello World")
const DUMMY_PDF_BASE64 = `JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDYyPj4Kc3RyZWFtCkJUCjEvRjEgMjQgVGYKMTAwIDEwMCBUZAooSGVsbG8gV29ybGQpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKMSAwIG9iago8PC9UeXBlL1BhZ2UvUmVzb3VyY2VzPDwvUHJvY1NldFsvUERGL1RleHQvSW1hZ2VCL0ltYWdlQy9JbWFnZUldL0ZvbnQ8PC9GMSA0IDAgUj4+Pj4vTWVkaWFCb3hbMCAwIDU5NS4yOCA4NDEuODldL0NvbnRlbnRzIDIgMCBSPj4KZW5kb2JqCjMgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDUgMCBSPj4KZW5kb2JqCjQgMCBvYmoKPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvSGVsdmV0aWNhPj4KZW5kb2JqCjUgMCBvYmoKPDwvVHlwZS9QYWdlcy9LaWRzWzEgMCBSXS9Db3VudCAxPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDEwOSAwMDAwMCBuIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAyMjUgMDAwMDAgbiAKMDAwMDAwMDI3NCAwMDAwMCBuIAowMDAwMDAwMzYyIDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA2L1Jvb3QgMyAwIFI+PgpzdGFydHhyZWYKNDE5CiUlRU9GCg==`;

const API_URL = 'http://localhost:5000/api/utils/resume-analyser'; // Fixed to use port 5000

interface BenchmarkResult {
  success: boolean;
  timeMs: number;
  error?: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function makeRequest(id: number): Promise<BenchmarkResult> {
  const start = performance.now();
  try {
    const response = await axios.post(
      API_URL,
      { pdfBase64: DUMMY_PDF_BASE64 },
      { headers: { 'Content-Type': 'application/json' }, timeout: 120000 } // Increased timeout to 2mins for AI
    );
    const end = performance.now();
    return { success: true, timeMs: end - start };
  } catch (error: any) {
    const end = performance.now();
    const errMsg = error.response ? `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}` : error.message;
    return { success: false, timeMs: end - start, error: errMsg };
  }
}

async function runBenchmark(concurrentRequests: number) {
  console.log(`\n🚀 Starting Benchmark with ${concurrentRequests} concurrent requests...`);
  console.log(`Target: ${API_URL}`);
  
  const startTotal = performance.now();
  
  // Create an array of promises to run concurrently
  const promises: Promise<BenchmarkResult>[] = [];
  for (let i = 0; i < concurrentRequests; i++) {
    promises.push(makeRequest(i));
  }

  const results = await Promise.all(promises);
  const endTotal = performance.now();

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  const times = successful.map(r => r.timeMs).sort((a, b) => a - b);
  const avgTime = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  const maxTime = times.length ? times[times.length - 1] : 0;
  const minTime = times.length ? times[0] : 0;

  console.log(`\n📊 --- BENCHMARK RESULTS (Synchronous Architecture) ---`);
  console.log(`Total Requests Sent : ${concurrentRequests}`);
  console.log(`Total Time Elapsed  : ${((endTotal - startTotal) / 1000).toFixed(2)} seconds`);
  console.log(`Successful Requests : ✅ ${successful.length}`);
  console.log(`Failed Requests     : ❌ ${failed.length}`);
  
  if (successful.length > 0) {
    console.log(`\n⏱️  Response Times (Successful):`);
    console.log(`   Fastest : ${(minTime / 1000).toFixed(2)}s`);
    console.log(`   Slowest : ${(maxTime / 1000).toFixed(2)}s`);
    console.log(`   Average : ${(avgTime / 1000).toFixed(2)}s`);
  }

  if (failed.length > 0) {
    console.log(`\n⚠️  Sample Errors:`);
    const uniqueErrors = Array.from(new Set(failed.map(f => f.error)));
    uniqueErrors.forEach(err => console.log(`   - ${err}`));
  }
  
  console.log(`------------------------------------------------------\n`);
}

async function main() {
  console.log("⚠️ Make sure your server is running (e.g. `npm run dev`) before starting!");
  await sleep(2000);
  
  // 1. Test single request to ensure it works
  await runBenchmark(1);
  
  await sleep(3000); // Cool down
  
  // 2. Test concurrent load (simulating 5 users uploading at the exact same time)
  // Warning: Depending on Groq API limits, this might fail some requests!
  await runBenchmark(5);
}

main().catch(console.error);
