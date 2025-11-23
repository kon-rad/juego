const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("BadgeNFT", function () {
  async function deployBadgeNFTFixture() {
    const [owner, player1, player2] = await ethers.getSigners();

    const BadgeNFT = await ethers.getContractFactory("BadgeNFT");
    const badgeNFT = await BadgeNFT.deploy();

    return { badgeNFT, owner, player1, player2 };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { badgeNFT, owner } = await loadFixture(deployBadgeNFTFixture);
      expect(await badgeNFT.owner()).to.equal(owner.address);
    });

    it("Should have correct name and symbol", async function () {
      const { badgeNFT } = await loadFixture(deployBadgeNFTFixture);
      expect(await badgeNFT.name()).to.equal("Juego Quest Badge");
      expect(await badgeNFT.symbol()).to.equal("BADGE");
    });

    it("Should start with tokenId 0", async function () {
      const { badgeNFT } = await loadFixture(deployBadgeNFTFixture);
      // First mint should be tokenId 0
      const { badgeNFT: badge, owner, player1 } = await loadFixture(deployBadgeNFTFixture);
      await badge.mintBadge(player1.address, 1, 8, 10, "Test Quiz");
      expect(await badge.ownerOf(0)).to.equal(player1.address);
    });
  });

  describe("Minting", function () {
    it("Should mint a badge to a player", async function () {
      const { badgeNFT, owner, player1 } = await loadFixture(deployBadgeNFTFixture);
      
      await expect(badgeNFT.mintBadge(player1.address, 1, 8, 10, "Test Quiz"))
        .to.emit(badgeNFT, "BadgeMinted")
        .withArgs(player1.address, 0, 1, 8, "Expert");

      expect(await badgeNFT.ownerOf(0)).to.equal(player1.address);
      expect(await badgeNFT.hasBadgeForQuiz(player1.address, 1)).to.be.true;
      expect(await badgeNFT.playerQuizBadge(player1.address, 1)).to.equal(0);
    });

    it("Should store correct badge data", async function () {
      const { badgeNFT, owner, player1 } = await loadFixture(deployBadgeNFTFixture);
      
      await badgeNFT.mintBadge(player1.address, 5, 7, 10, "Math Quiz");
      const badge = await badgeNFT.badges(0);

      expect(badge.quizId).to.equal(5);
      expect(badge.correctAnswers).to.equal(7);
      expect(badge.totalQuestions).to.equal(10);
      expect(badge.quizName).to.equal("Math Quiz");
      expect(badge.completedAt).to.be.gt(0);
    });

    it("Should prevent non-owner from minting", async function () {
      const { badgeNFT, player1, player2 } = await loadFixture(deployBadgeNFTFixture);
      
      await expect(
        badgeNFT.connect(player1).mintBadge(player2.address, 1, 8, 10, "Test Quiz")
      ).to.be.revertedWithCustomError(badgeNFT, "OwnableUnauthorizedAccount");
    });

    it("Should increment tokenId for each mint", async function () {
      const { badgeNFT, owner, player1 } = await loadFixture(deployBadgeNFTFixture);
      
      await badgeNFT.mintBadge(player1.address, 1, 8, 10, "Quiz 1");
      await badgeNFT.mintBadge(player1.address, 2, 9, 10, "Quiz 2");

      expect(await badgeNFT.ownerOf(0)).to.equal(player1.address);
      expect(await badgeNFT.ownerOf(1)).to.equal(player1.address);
    });

    it("Should allow multiple badges for same quiz if minted separately", async function () {
      const { badgeNFT, owner, player1 } = await loadFixture(deployBadgeNFTFixture);
      
      await badgeNFT.mintBadge(player1.address, 1, 8, 10, "Quiz 1");
      await badgeNFT.mintBadge(player1.address, 1, 9, 10, "Quiz 1 Updated");

      // Both badges should exist
      expect(await badgeNFT.ownerOf(0)).to.equal(player1.address);
      expect(await badgeNFT.ownerOf(1)).to.equal(player1.address);
      // The mapping will point to the latest badge
      expect(await badgeNFT.playerQuizBadge(player1.address, 1)).to.equal(1);
    });
  });

  describe("Tier Calculation", function () {
    it("Should return Perfect tier for 100% score", async function () {
      const { badgeNFT, owner, player1 } = await loadFixture(deployBadgeNFTFixture);
      
      await badgeNFT.mintBadge(player1.address, 1, 10, 10, "Perfect Quiz");
      expect(await badgeNFT.getBadgeTier(0)).to.equal("Perfect");
    });

    it("Should return Expert tier for 80-99% score", async function () {
      const { badgeNFT, owner, player1 } = await loadFixture(deployBadgeNFTFixture);
      
      await badgeNFT.mintBadge(player1.address, 1, 8, 10, "Expert Quiz");
      expect(await badgeNFT.getBadgeTier(0)).to.equal("Expert");

      await badgeNFT.mintBadge(player1.address, 2, 9, 10, "Expert Quiz 2");
      expect(await badgeNFT.getBadgeTier(1)).to.equal("Expert");
    });

    it("Should return Advanced tier for 60-79% score", async function () {
      const { badgeNFT, owner, player1 } = await loadFixture(deployBadgeNFTFixture);
      
      await badgeNFT.mintBadge(player1.address, 1, 6, 10, "Advanced Quiz");
      expect(await badgeNFT.getBadgeTier(0)).to.equal("Advanced");

      await badgeNFT.mintBadge(player1.address, 2, 7, 10, "Advanced Quiz 2");
      expect(await badgeNFT.getBadgeTier(1)).to.equal("Advanced");
    });

    it("Should return Basic tier for <60% score", async function () {
      const { badgeNFT, owner, player1 } = await loadFixture(deployBadgeNFTFixture);
      
      await badgeNFT.mintBadge(player1.address, 1, 5, 10, "Basic Quiz");
      expect(await badgeNFT.getBadgeTier(0)).to.equal("Basic");

      await badgeNFT.mintBadge(player1.address, 2, 0, 10, "Basic Quiz 2");
      expect(await badgeNFT.getBadgeTier(1)).to.equal("Basic");
    });

    it("Should return Basic tier when totalQuestions is 0", async function () {
      const { badgeNFT, owner, player1 } = await loadFixture(deployBadgeNFTFixture);
      
      await badgeNFT.mintBadge(player1.address, 1, 5, 0, "Edge Case Quiz");
      expect(await badgeNFT.getBadgeTier(0)).to.equal("Basic");
    });
  });

  describe("Token URI and SVG Generation", function () {
    it("Should generate valid tokenURI", async function () {
      const { badgeNFT, owner, player1 } = await loadFixture(deployBadgeNFTFixture);
      
      await badgeNFT.mintBadge(player1.address, 1, 8, 10, "Test Quiz");
      const uri = await badgeNFT.tokenURI(0);

      // Should be a data URI
      expect(uri).to.include("data:application/json;base64,");
      
      // Decode and verify JSON structure
      const base64Data = uri.split(",")[1];
      const jsonString = Buffer.from(base64Data, "base64").toString("utf-8");
      const metadata = JSON.parse(jsonString);

      expect(metadata.name).to.include("Juego Quest Badge #0");
      expect(metadata.description).to.equal("A badge earned by completing a quiz on Juego Quest");
      expect(metadata.image).to.include("data:image/svg+xml;base64,");
      expect(metadata.attributes).to.be.an("array");
    });

    it("Should include correct attributes in metadata", async function () {
      const { badgeNFT, owner, player1 } = await loadFixture(deployBadgeNFTFixture);
      
      await badgeNFT.mintBadge(player1.address, 42, 8, 10, "Math Quiz");
      const uri = await badgeNFT.tokenURI(0);
      const base64Data = uri.split(",")[1];
      const jsonString = Buffer.from(base64Data, "base64").toString("utf-8");
      const metadata = JSON.parse(jsonString);

      expect(metadata.attributes).to.have.lengthOf(5);
      
      const quizIdAttr = metadata.attributes.find(a => a.trait_type === "Quiz ID");
      expect(quizIdAttr.value).to.equal("42");

      const quizNameAttr = metadata.attributes.find(a => a.trait_type === "Quiz Name");
      expect(quizNameAttr.value).to.equal("Math Quiz");

      const scoreAttr = metadata.attributes.find(a => a.trait_type === "Score");
      expect(scoreAttr.value).to.equal("8/10");

      const tierAttr = metadata.attributes.find(a => a.trait_type === "Tier");
      expect(tierAttr.value).to.equal("Expert");

      const completedAtAttr = metadata.attributes.find(a => a.trait_type === "Completed At");
      expect(completedAtAttr.display_type).to.equal("date");
      expect(completedAtAttr.value).to.be.a("string");
    });

    it("Should generate valid SVG image", async function () {
      const { badgeNFT, owner, player1 } = await loadFixture(deployBadgeNFTFixture);
      
      await badgeNFT.mintBadge(player1.address, 1, 8, 10, "Test Quiz");
      const uri = await badgeNFT.tokenURI(0);
      const base64Data = uri.split(",")[1];
      const jsonString = Buffer.from(base64Data, "base64").toString("utf-8");
      const metadata = JSON.parse(jsonString);

      const imageBase64 = metadata.image.split(",")[1];
      const svgString = Buffer.from(imageBase64, "base64").toString("utf-8");

      // Verify SVG structure
      expect(svgString).to.include("<svg");
      expect(svgString).to.include("xmlns=\"http://www.w3.org/2000/svg\"");
      expect(svgString).to.include("viewBox=\"0 0 400 400\"");
      expect(svgString).to.include("8/10"); // Score
      expect(svgString).to.include("Test Quiz"); // Quiz name
      expect(svgString).to.include("Expert Tier"); // Tier
      expect(svgString).to.include("Juego Quest Badge #0"); // Token ID
    });

    it("Should use correct tier colors in SVG", async function () {
      const { badgeNFT, owner, player1 } = await loadFixture(deployBadgeNFTFixture);
      
      // Perfect tier - Gold
      await badgeNFT.mintBadge(player1.address, 1, 10, 10, "Perfect");
      let uri = await badgeNFT.tokenURI(0);
      let svg = Buffer.from(JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString("utf-8")).image.split(",")[1], "base64").toString("utf-8");
      expect(svg).to.include("#FFD700"); // Gold

      // Expert tier - Silver
      await badgeNFT.mintBadge(player1.address, 2, 8, 10, "Expert");
      uri = await badgeNFT.tokenURI(1);
      svg = Buffer.from(JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString("utf-8")).image.split(",")[1], "base64").toString("utf-8");
      expect(svg).to.include("#C0C0C0"); // Silver

      // Advanced tier - Bronze
      await badgeNFT.mintBadge(player1.address, 3, 6, 10, "Advanced");
      uri = await badgeNFT.tokenURI(2);
      svg = Buffer.from(JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString("utf-8")).image.split(",")[1], "base64").toString("utf-8");
      expect(svg).to.include("#CD7F32"); // Bronze

      // Basic tier - Blue
      await badgeNFT.mintBadge(player1.address, 4, 5, 10, "Basic");
      uri = await badgeNFT.tokenURI(3);
      svg = Buffer.from(JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString("utf-8")).image.split(",")[1], "base64").toString("utf-8");
      expect(svg).to.include("#4A90D9"); // Blue
    });

    it("Should handle special characters in quiz name", async function () {
      const { badgeNFT, owner, player1 } = await loadFixture(deployBadgeNFTFixture);
      
      await badgeNFT.mintBadge(player1.address, 1, 8, 10, "Quiz with 'quotes' & symbols!");
      const uri = await badgeNFT.tokenURI(0);
      const base64Data = uri.split(",")[1];
      const jsonString = Buffer.from(base64Data, "base64").toString("utf-8");
      const metadata = JSON.parse(jsonString);

      expect(metadata.attributes.find(a => a.trait_type === "Quiz Name").value).to.equal("Quiz with 'quotes' & symbols!");
    });

    it("Should revert tokenURI for non-existent token", async function () {
      const { badgeNFT } = await loadFixture(deployBadgeNFTFixture);
      
      await expect(badgeNFT.tokenURI(999)).to.be.reverted;
    });
  });

  describe("Base URI", function () {
    it("Should allow owner to set baseURI", async function () {
      const { badgeNFT, owner } = await loadFixture(deployBadgeNFTFixture);
      
      await expect(badgeNFT.setBaseURI("https://api.example.com/metadata/"))
        .to.emit(badgeNFT, "BaseURIUpdated")
        .withArgs("", "https://api.example.com/metadata/");

      expect(await badgeNFT.baseURI()).to.equal("https://api.example.com/metadata/");
    });

    it("Should prevent non-owner from setting baseURI", async function () {
      const { badgeNFT, player1 } = await loadFixture(deployBadgeNFTFixture);
      
      await expect(
        badgeNFT.connect(player1).setBaseURI("https://malicious.com/")
      ).to.be.revertedWithCustomError(badgeNFT, "OwnableUnauthorizedAccount");
    });
  });

  describe("ERC721Enumerable", function () {
    it("Should track total supply correctly", async function () {
      const { badgeNFT, owner, player1 } = await loadFixture(deployBadgeNFTFixture);
      
      expect(await badgeNFT.totalSupply()).to.equal(0);
      
      await badgeNFT.mintBadge(player1.address, 1, 8, 10, "Quiz 1");
      expect(await badgeNFT.totalSupply()).to.equal(1);
      
      await badgeNFT.mintBadge(player1.address, 2, 9, 10, "Quiz 2");
      expect(await badgeNFT.totalSupply()).to.equal(2);
    });

    it("Should track tokens by index", async function () {
      const { badgeNFT, owner, player1 } = await loadFixture(deployBadgeNFTFixture);
      
      await badgeNFT.mintBadge(player1.address, 1, 8, 10, "Quiz 1");
      await badgeNFT.mintBadge(player1.address, 2, 9, 10, "Quiz 2");

      expect(await badgeNFT.tokenByIndex(0)).to.equal(0);
      expect(await badgeNFT.tokenByIndex(1)).to.equal(1);
    });

    it("Should track tokens of owner", async function () {
      const { badgeNFT, owner, player1, player2 } = await loadFixture(deployBadgeNFTFixture);
      
      await badgeNFT.mintBadge(player1.address, 1, 8, 10, "Quiz 1");
      await badgeNFT.mintBadge(player1.address, 2, 9, 10, "Quiz 2");
      await badgeNFT.mintBadge(player2.address, 3, 7, 10, "Quiz 3");

      expect(await badgeNFT.balanceOf(player1.address)).to.equal(2);
      expect(await badgeNFT.balanceOf(player2.address)).to.equal(1);
      
      expect(await badgeNFT.tokenOfOwnerByIndex(player1.address, 0)).to.equal(0);
      expect(await badgeNFT.tokenOfOwnerByIndex(player1.address, 1)).to.equal(1);
      expect(await badgeNFT.tokenOfOwnerByIndex(player2.address, 0)).to.equal(2);
    });
  });

  describe("Transfer", function () {
    it("Should allow badge transfer", async function () {
      const { badgeNFT, owner, player1, player2 } = await loadFixture(deployBadgeNFTFixture);
      
      await badgeNFT.mintBadge(player1.address, 1, 8, 10, "Quiz 1");
      await badgeNFT.connect(player1).transferFrom(player1.address, player2.address, 0);

      expect(await badgeNFT.ownerOf(0)).to.equal(player2.address);
      // Note: hasBadgeForQuiz mapping doesn't update on transfer - this is a design choice
    });
  });
});

