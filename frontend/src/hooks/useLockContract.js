// src/hooks/useLockContract.js
import { useEffect, useState } from "react";
import { ethers } from "ethers";
import LockABI from "../abi/Lock.json";
import { CONTRACT_ADDRESS } from "../abi/address.js";

export function useLockContract() {
  const [contract, setContract] = useState(null);

  useEffect(() => {
    const connect = async () => {
      try {
        if (!window.ethereum) throw new Error("MetaMask not detected");

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        const code = await provider.getCode(CONTRACT_ADDRESS);
        if (code === "0x") {
          throw new Error("No contract found at this address");
        }

        const contractInstance = new ethers.Contract(
          CONTRACT_ADDRESS,
          LockABI.abi,
          signer
        );
        setContract(contractInstance);
      } catch (err) {
        console.error("⚠️ useLockContract error:", err.message);
      }
    };

    connect();
  }, []);

  return contract;
}
