const func = async function (hre) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, get, execute } = deployments;

  const { deployer } = await getNamedAccounts();

  // Get previously deployed contracts
  const learnToken = await get("LearnToken");
  const badgeNFT = await get("BadgeNFT");

  console.log("Deploying QuizGame with deployer:", deployer);
  console.log("LearnToken address:", learnToken.address);
  console.log("BadgeNFT address:", badgeNFT.address);

  const quizGame = await deploy("QuizGame", {
    from: deployer,
    args: [learnToken.address, badgeNFT.address],
    log: true,
    waitConfirmations: 1,
  });

  console.log("QuizGame deployed at:", quizGame.address);

  // Set QuizGame as the authorized minter for LearnToken
  console.log("Setting QuizGame as authorized minter for LearnToken...");
  await execute(
    "LearnToken",
    { from: deployer, log: true },
    "setQuizGame",
    quizGame.address
  );

  // Set QuizGame as the authorized minter for BadgeNFT
  console.log("Setting QuizGame as authorized minter for BadgeNFT...");
  await execute(
    "BadgeNFT",
    { from: deployer, log: true },
    "setQuizGame",
    quizGame.address
  );

  console.log("Deployment complete!");
  console.log("=".repeat(50));
  console.log("Contract Addresses:");
  console.log("  LearnToken:", learnToken.address);
  console.log("  BadgeNFT:", badgeNFT.address);
  console.log("  QuizGame:", quizGame.address);
  console.log("=".repeat(50));
};

module.exports = func;
func.tags = ["QuizGame"];
func.dependencies = ["LearnToken", "BadgeNFT"];
