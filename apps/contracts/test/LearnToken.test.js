const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("LearnToken", function () {
  async function deployLearnTokenFixture() {
    const [owner, player1, player2] = await ethers.getSigners();

    const LearnToken = await ethers.getContractFactory("LearnToken");
    const learnToken = await LearnToken.deploy();

    return { learnToken, owner, player1, player2 };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { learnToken, owner } = await loadFixture(deployLearnTokenFixture);
      expect(await learnToken.owner()).to.equal(owner.address);
    });

    it("Should have correct name and symbol", async function () {
      const { learnToken } = await loadFixture(deployLearnTokenFixture);
      expect(await learnToken.name()).to.equal("Learn Token");
      expect(await learnToken.symbol()).to.equal("LEARN");
    });

    it("Should have zero initial supply", async function () {
      const { learnToken } = await loadFixture(deployLearnTokenFixture);
      expect(await learnToken.totalSupply()).to.equal(0);
    });
  });

  describe("Minting", function () {
    it("Should mint tokens to a player", async function () {
      const { learnToken, owner, player1 } = await loadFixture(deployLearnTokenFixture);
      
      const amount = ethers.parseEther("100");
      await learnToken.mint(player1.address, amount);

      expect(await learnToken.balanceOf(player1.address)).to.equal(amount);
      expect(await learnToken.totalSupply()).to.equal(amount);
    });

    it("Should allow multiple mints", async function () {
      const { learnToken, owner, player1 } = await loadFixture(deployLearnTokenFixture);
      
      await learnToken.mint(player1.address, ethers.parseEther("100"));
      await learnToken.mint(player1.address, ethers.parseEther("50"));

      expect(await learnToken.balanceOf(player1.address)).to.equal(ethers.parseEther("150"));
      expect(await learnToken.totalSupply()).to.equal(ethers.parseEther("150"));
    });

    it("Should prevent non-owner from minting", async function () {
      const { learnToken, player1, player2 } = await loadFixture(deployLearnTokenFixture);
      
      await expect(
        learnToken.connect(player1).mint(player2.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(learnToken, "OwnableUnauthorizedAccount");
    });

    it("Should revert when minting to zero address", async function () {
      const { learnToken, owner } = await loadFixture(deployLearnTokenFixture);
      
      await expect(
        learnToken.mint(ethers.ZeroAddress, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(learnToken, "ZeroAddress");
    });

    it("Should handle large mint amounts", async function () {
      const { learnToken, owner, player1 } = await loadFixture(deployLearnTokenFixture);
      
      const largeAmount = ethers.parseEther("1000000");
      await learnToken.mint(player1.address, largeAmount);

      expect(await learnToken.balanceOf(player1.address)).to.equal(largeAmount);
    });
  });

  describe("ERC20 Standard", function () {
    it("Should allow token transfers", async function () {
      const { learnToken, owner, player1, player2 } = await loadFixture(deployLearnTokenFixture);
      
      await learnToken.mint(player1.address, ethers.parseEther("100"));
      await learnToken.connect(player1).transfer(player2.address, ethers.parseEther("50"));

      expect(await learnToken.balanceOf(player1.address)).to.equal(ethers.parseEther("50"));
      expect(await learnToken.balanceOf(player2.address)).to.equal(ethers.parseEther("50"));
    });

    it("Should allow approved transfers", async function () {
      const { learnToken, owner, player1, player2 } = await loadFixture(deployLearnTokenFixture);
      
      await learnToken.mint(player1.address, ethers.parseEther("100"));
      await learnToken.connect(player1).approve(player2.address, ethers.parseEther("50"));
      await learnToken.connect(player2).transferFrom(player1.address, player2.address, ethers.parseEther("50"));

      expect(await learnToken.balanceOf(player1.address)).to.equal(ethers.parseEther("50"));
      expect(await learnToken.balanceOf(player2.address)).to.equal(ethers.parseEther("50"));
    });
  });
});

