const func = async function (hre) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  console.log("Deploying LearnToken with deployer:", deployer);

  await deploy("LearnToken", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
  });
};

module.exports = func;
func.tags = ["LearnToken"];
