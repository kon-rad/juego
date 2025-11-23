const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Testing NFT Image Rendering...\n");

  // Get signers
  const [owner, player] = await hre.ethers.getSigners();
  console.log("Owner:", owner.address);
  console.log("Player:", player.address);
  console.log();

  // Deploy BadgeNFT
  console.log("Deploying BadgeNFT...");
  const BadgeNFT = await hre.ethers.getContractFactory("BadgeNFT");
  const badgeNFT = await BadgeNFT.deploy();
  await badgeNFT.waitForDeployment();
  console.log("BadgeNFT deployed to:", await badgeNFT.getAddress());
  console.log();

  // Test cases for different tiers
  const testCases = [
    { quizId: 1, correct: 10, total: 10, name: "Perfect Quiz", expectedTier: "Perfect" },
    { quizId: 2, correct: 8, total: 10, name: "Expert Quiz", expectedTier: "Expert" },
    { quizId: 3, correct: 6, total: 10, name: "Advanced Quiz", expectedTier: "Advanced" },
    { quizId: 4, correct: 5, total: 10, name: "Basic Quiz", expectedTier: "Basic" },
    { quizId: 5, correct: 9, total: 10, name: "Quiz with 'quotes' & symbols!", expectedTier: "Expert" },
  ];

  console.log("Minting badges and testing tokenURI...\n");

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`Test ${i + 1}: ${testCase.name}`);
    console.log(`  Score: ${testCase.correct}/${testCase.total} (Expected Tier: ${testCase.expectedTier})`);

    // Mint badge
    const tx = await badgeNFT.mintBadge(
      player.address,
      testCase.quizId,
      testCase.correct,
      testCase.total,
      testCase.name
    );
    await tx.wait();

    const tokenId = i; // Token IDs start at 0

    // Get tier
    const tier = await badgeNFT.getBadgeTier(tokenId);
    console.log(`  Actual Tier: ${tier}`);
    
    if (tier !== testCase.expectedTier) {
      console.log(`  ❌ ERROR: Tier mismatch! Expected ${testCase.expectedTier}, got ${tier}`);
    } else {
      console.log(`  ✅ Tier correct`);
    }

    // Get tokenURI
    const tokenURI = await badgeNFT.tokenURI(tokenId);
    console.log(`  TokenURI length: ${tokenURI.length} characters`);

    // Decode and verify
    try {
      // Extract base64 data
      const base64Data = tokenURI.split(",")[1];
      if (!base64Data) {
        console.log(`  ❌ ERROR: Invalid tokenURI format`);
        continue;
      }

      // Decode JSON
      const jsonString = Buffer.from(base64Data, "base64").toString("utf-8");
      const metadata = JSON.parse(jsonString);

      // Verify structure
      console.log(`  ✅ JSON parsed successfully`);
      console.log(`  Name: ${metadata.name}`);
      console.log(`  Description: ${metadata.description}`);
      console.log(`  Attributes count: ${metadata.attributes.length}`);

      // Verify image
      if (metadata.image && metadata.image.startsWith("data:image/svg+xml;base64,")) {
        console.log(`  ✅ Image format correct`);
        
        // Decode SVG
        const svgBase64 = metadata.image.split(",")[1];
        const svgString = Buffer.from(svgBase64, "base64").toString("utf-8");
        
        // Verify SVG structure
        if (svgString.includes("<svg") && svgString.includes("viewBox=\"0 0 400 400\"")) {
          console.log(`  ✅ SVG structure valid`);
          
          // Check for expected content
          if (svgString.includes(`${testCase.correct}/${testCase.total}`)) {
            console.log(`  ✅ Score in SVG: ${testCase.correct}/${testCase.total}`);
          } else {
            console.log(`  ⚠️  Score not found in SVG`);
          }

          if (svgString.includes(testCase.name)) {
            console.log(`  ✅ Quiz name in SVG`);
          } else {
            console.log(`  ⚠️  Quiz name not found in SVG (may be escaped)`);
          }

          if (svgString.includes(tier)) {
            console.log(`  ✅ Tier in SVG: ${tier}`);
          } else {
            console.log(`  ⚠️  Tier not found in SVG`);
          }

          // Save SVG to file for visual inspection
          const filename = `test-badge-${tokenId}-${tier.toLowerCase()}.svg`;
          fs.writeFileSync(filename, svgString);
          console.log(`  💾 SVG saved to: ${filename}`);
        } else {
          console.log(`  ❌ ERROR: Invalid SVG structure`);
        }
      } else {
        console.log(`  ❌ ERROR: Invalid image format`);
      }

      // Verify attributes
      const quizIdAttr = metadata.attributes.find(a => a.trait_type === "Quiz ID");
      const quizNameAttr = metadata.attributes.find(a => a.trait_type === "Quiz Name");
      const scoreAttr = metadata.attributes.find(a => a.trait_type === "Score");
      const tierAttr = metadata.attributes.find(a => a.trait_type === "Tier");

      if (quizIdAttr && quizIdAttr.value === testCase.quizId.toString()) {
        console.log(`  ✅ Quiz ID attribute correct`);
      }
      if (quizNameAttr && quizNameAttr.value === testCase.name) {
        console.log(`  ✅ Quiz Name attribute correct`);
      }
      if (scoreAttr && scoreAttr.value === `${testCase.correct}/${testCase.total}`) {
        console.log(`  ✅ Score attribute correct`);
      }
      if (tierAttr && tierAttr.value === tier) {
        console.log(`  ✅ Tier attribute correct`);
      }

    } catch (error) {
      console.log(`  ❌ ERROR parsing tokenURI: ${error.message}`);
    }

    console.log();
  }

  // Test edge cases
  console.log("Testing edge cases...\n");

  // Test invalid inputs (should revert)
  console.log("Test: Minting with invalid score (should revert)");
  try {
    await badgeNFT.mintBadge(player.address, 99, 11, 10, "Invalid Score");
    console.log("  ❌ ERROR: Should have reverted!");
  } catch (error) {
    if (error.message.includes("InvalidScore")) {
      console.log("  ✅ Correctly reverted with InvalidScore error");
    } else {
      console.log(`  ⚠️  Reverted but with unexpected error: ${error.message}`);
    }
  }

  console.log("\nTest: Minting with zero total questions (should revert)");
  try {
    await badgeNFT.mintBadge(player.address, 99, 5, 0, "Zero Total");
    console.log("  ❌ ERROR: Should have reverted!");
  } catch (error) {
    if (error.message.includes("InvalidTotalQuestions")) {
      console.log("  ✅ Correctly reverted with InvalidTotalQuestions error");
    } else {
      console.log(`  ⚠️  Reverted but with unexpected error: ${error.message}`);
    }
  }

  console.log("\nTest: Minting with zero address (should revert)");
  try {
    await badgeNFT.mintBadge(hre.ethers.ZeroAddress, 99, 5, 10, "Zero Address");
    console.log("  ❌ ERROR: Should have reverted!");
  } catch (error) {
    if (error.message.includes("ZeroAddress")) {
      console.log("  ✅ Correctly reverted with ZeroAddress error");
    } else {
      console.log(`  ⚠️  Reverted but with unexpected error: ${error.message}`);
    }
  }

  console.log("\n✅ NFT Image Rendering Test Complete!");
  console.log("\nGenerated SVG files can be opened in a browser to verify visual rendering.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

