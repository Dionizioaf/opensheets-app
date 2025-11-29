import { parseOFX, isOfxFile } from "./parser";

// Simple test without actual OFX content
async function testParser() {
    try {
        console.log("Testing OFX parser functions...");

        // Test file type validation
        console.log("isOfxFile('test.ofx'):", isOfxFile("test.ofx"));
        console.log("isOfxFile('test.txt'):", isOfxFile("test.txt"));

        // Test with minimal content (this will likely fail but test the error handling)
        const minimalOfx = `<?xml version="1.0"?><OFX></OFX>`;

        try {
            const result = await parseOFX(minimalOfx);
            console.log("✅ Basic parsing works!");
            console.log("Result:", result);
        } catch (error) {
            console.log("Expected parsing error (minimal OFX):", error instanceof Error ? error.message : String(error));
        }

    } catch (error) {
        console.error("❌ Test failed:", error);
    }
}

// Run the test
testParser();