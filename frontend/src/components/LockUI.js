import React, { useEffect, useState } from "react";
import { useLockContract } from "../hooks/useLockContract";
import "../App.css";

export default function LockUI() {
  const [wallet, setWallet] = useState("");
  const [unlockTime, setUnlockTime] = useState(null);
  const [canWithdraw, setCanWithdraw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contractLoading, setContractLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const contract = useLockContract();

  const connect = async () => {
    try {
      setError("");
      const [addr] = await window.ethereum.request({
        method: "eth_requestAccounts"
      });
      setWallet(addr);
      return addr;
    } catch (err) {
      setError("Failed to connect wallet: " + err.message);
      return null;
    }
  };

  const fetchContractData = async () => {
    if (!contract) return;
    try {
      setContractLoading(true);
      setError("");
      const time = await contract.unlockTime();
      setUnlockTime(Number(time));
      setCanWithdraw(now >= Number(time));
    } catch (err) {
      console.error("🔴 Error calling unlockTime():", err.message);
      setError("Failed to fetch contract data: " + err.message);
    } finally {
      setContractLoading(false);
    }
  };

  const withdraw = async () => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const tx = await contract.withdraw();
      setSuccess("Transaction submitted! Waiting for confirmation...");

      await tx.wait();
      setSuccess(
        "Withdrawal successful! Funds have been transferred to your wallet."
      );

      setTimeout(() => {
        fetchContractData();
      }, 2000);
    } catch (err) {
      setError("Withdrawal failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (contract) {
      connect().then(() => {
        fetchContractData();
      });
    }
  }, [contract]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
      if (unlockTime && now >= unlockTime && !canWithdraw) {
        setCanWithdraw(true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [unlockTime, now, canWithdraw]);

  const formatTimeLeft = (seconds) => {
    if (seconds <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return { days, hours, minutes, seconds: secs };
  };

  const formatAddress = (address) => {
    if (!address) return "Not connected";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess("Address copied to clipboard");
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const timeLeft = unlockTime ? Math.max(0, unlockTime - now) : null;
  const isUnlocked = timeLeft === 0 || canWithdraw;
  const timeComponents = timeLeft
    ? formatTimeLeft(timeLeft)
    : { days: 0, hours: 0, minutes: 0, seconds: 0 };

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 bg-white border border-gray-200 rounded-xl shadow-md space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Timelock Contract
        </h1>
        <p className="text-sm text-gray-500">
          Secure time-locked fund management
        </p>
      </div>

      {/* Wallet Info */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Wallet</h3>
          <p className="text-xs font-mono text-gray-600">
            {formatAddress(wallet)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-2 py-1 text-xs font-semibold rounded ${
              wallet ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            {wallet ? "Connected" : "Disconnected"}
          </span>
          {wallet && (
            <button
              onClick={() => copyToClipboard(wallet)}
              className="text-sm text-blue-500 hover:text-blue-700 transition"
              title="Copy address"
            >
              Copy
            </button>
          )}
        </div>
      </div>

      {/* Contract Info */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-800">
            Contract Status
          </h3>
          <span
            className={`px-2 py-1 text-xs font-semibold rounded ${
              contractLoading
                ? "bg-yellow-100 text-yellow-800"
                : unlockTime
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {contractLoading
              ? "Loading..."
              : unlockTime
              ? "Active"
              : "Unavailable"}
          </span>
        </div>
        {unlockTime && (
          <>
            <p className="text-xs text-gray-500 mb-1">Unlock Date</p>
            <p className="text-sm font-mono text-gray-700">
              {new Date(unlockTime * 1000).toLocaleString()}
            </p>
          </>
        )}
      </div>

      {/* Countdown */}
      {unlockTime && (
        <div className="p-6 border border-gray-200 rounded-lg text-center space-y-3">
          {isUnlocked ? (
            <>
              <h2 className="text-lg font-bold text-green-600">
                ✅ Ready to Withdraw
              </h2>
              <p className="text-sm text-gray-600">
                Your funds are now available for withdrawal.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-md font-medium text-gray-800">
                Time Remaining
              </h2>
              <div className="grid grid-cols-4 gap-4 mt-2 text-center text-sm">
                {["Days", "Hours", "Minutes", "Seconds"].map((label, idx) => (
                  <div key={label}>
                    <div className="text-xl font-bold text-gray-900">
                      {
                        [
                          timeComponents.days,
                          timeComponents.hours,
                          timeComponents.minutes,
                          timeComponents.seconds
                        ][idx]
                      }
                    </div>
                    <div className="text-gray-500">{label}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Feedback */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* Actions */}
      <div>
        {!wallet ? (
          <button
            onClick={connect}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition"
          >
            Connect Wallet
          </button>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={withdraw}
              disabled={!canWithdraw || loading || contractLoading}
              className={`w-full text-sm font-medium py-2 px-4 rounded-lg transition ${
                canWithdraw && !loading && !contractLoading
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {loading
                ? "Processing..."
                : canWithdraw
                ? "Withdraw Funds"
                : "Funds Locked"}
            </button>
            <button
              onClick={fetchContractData}
              disabled={contractLoading}
              className="w-full bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 font-medium py-2 px-4 rounded-lg transition"
            >
              {contractLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
