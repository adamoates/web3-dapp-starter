const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

async function main() {
  const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
  const unlockTime = Math.floor(Date.now() / 1000) + ONE_YEAR_IN_SECS;
  const lockedAmount = ethers.parseEther("0.01"); // 0.01 ETH

  const Lock = await ethers.getContractFactory("Lock");
  const lock = await Lock.deploy(unlockTime, {
    value: lockedAmount
  });

  await lock.waitForDeployment();
  const lockAddress = await lock.getAddress(); // Store the address first

  console.log(`🔒 Lock deployed to: ${lockAddress}`);
  console.log(`🔐 Unlocks at: ${unlockTime}`);

  const frontendDir = path.resolve(__dirname, "../../frontend/src/abi");
  console.log(frontendDir);
  if (!fs.existsSync(frontendDir))
    fs.mkdirSync(frontendDir, { recursive: true });

  fs.writeFileSync(
    path.join(frontendDir, "address.js"),
    `export const CONTRACT_ADDRESS = "${lockAddress}";\n`
  );

  const artifact = await hre.artifacts.readArtifact("Lock");
  fs.writeFileSync(
    path.join(frontendDir, "Lock.json"),
    JSON.stringify(artifact.abi, null, 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
