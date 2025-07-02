const Web3Service = require("../../../src/services/Web3Service");

// Create a mock Web3 instance
const mockWeb3 = {
  eth: {
    getBlockNumber: jest.fn().mockResolvedValue(12345),
    getBlock: jest.fn().mockResolvedValue({
      number: 12345,
      hash: "0x1234567890abcdef",
      timestamp: 1234567890
    }),
    getTransaction: jest.fn().mockResolvedValue({
      hash: "0x1234567890abcdef",
      from: "0x1234567890123456789012345678901234567890",
      to: "0x0987654321098765432109876543210987654321",
      value: "1000000000000000000",
      gas: 21000,
      gasPrice: "20000000000"
    }),
    getTransactionReceipt: jest.fn().mockResolvedValue({
      status: true,
      gasUsed: 21000,
      blockNumber: 12345
    }),
    getCode: jest.fn().mockResolvedValue("0x1234567890abcdef"),
    Contract: jest.fn().mockImplementation(() => ({
      methods: {
        name: jest.fn().mockReturnValue({
          call: jest.fn().mockResolvedValue("Test Token")
        }),
        symbol: jest.fn().mockReturnValue({
          call: jest.fn().mockResolvedValue("TEST")
        }),
        totalSupply: jest.fn().mockReturnValue({
          call: jest.fn().mockResolvedValue("1000000000000000000000000")
        }),
        balanceOf: jest.fn().mockReturnValue({
          call: jest.fn().mockResolvedValue("100000000000000000000")
        })
      }
    }))
  },
  utils: {
    fromWei: jest.fn().mockImplementation((value) => value / 1e18),
    toWei: jest.fn().mockImplementation((value) => value * 1e18),
    isAddress: jest.fn().mockReturnValue(true)
  }
};

// Mock Web3 constructor
jest.mock("web3", () => {
  return jest.fn().mockImplementation(() => mockWeb3);
});

describe("Web3Service", () => {
  let web3Service;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create service instance
    web3Service = new Web3Service("http://localhost:8545");
  });

  describe("constructor", () => {
    it("should initialize with provider URL", () => {
      expect(web3Service.web3).toBeDefined();
      expect(web3Service.providerUrl).toBe("http://localhost:8545");
    });
  });

  describe("getBlockNumber", () => {
    it("should get current block number", async () => {
      const blockNumber = await web3Service.getBlockNumber();

      expect(blockNumber).toBe(12345);
      expect(mockWeb3.eth.getBlockNumber).toHaveBeenCalled();
    });

    it("should handle errors", async () => {
      mockWeb3.eth.getBlockNumber.mockRejectedValue(new Error("Network error"));

      await expect(web3Service.getBlockNumber()).rejects.toThrow(
        "Network error"
      );
    });
  });

  describe("getBlock", () => {
    it("should get block by number", async () => {
      const block = await web3Service.getBlock(12345);

      expect(block).toEqual({
        number: 12345,
        hash: "0x1234567890abcdef",
        parentHash: undefined,
        timestamp: 1234567890,
        transactions: 0
      });
      expect(mockWeb3.eth.getBlock).toHaveBeenCalledWith(12345);
    });

    it("should handle block not found", async () => {
      mockWeb3.eth.getBlock.mockResolvedValue(null);

      const block = await web3Service.getBlock(99999);

      expect(block).toBeNull();
    });
  });

  describe("getTransaction", () => {
    it("should get transaction by hash", async () => {
      const txHash = "0x1234567890abcdef";
      const transaction = await web3Service.getTransaction(txHash);

      expect(transaction).toEqual({
        hash: "0x1234567890abcdef",
        from: "0x1234567890123456789012345678901234567890",
        to: "0x0987654321098765432109876543210987654321",
        value: "1000000000000000000",
        gas: 21000,
        gasPrice: "20000000000",
        nonce: undefined,
        blockNumber: undefined
      });
      expect(mockWeb3.eth.getTransaction).toHaveBeenCalledWith(txHash);
    });

    it("should handle transaction not found", async () => {
      mockWeb3.eth.getTransaction.mockResolvedValue(null);

      const transaction = await web3Service.getTransaction("0xinvalid");

      expect(transaction).toBeNull();
    });
  });

  describe("getTransactionReceipt", () => {
    it("should get transaction receipt", async () => {
      const txHash = "0x1234567890abcdef";
      const receipt = await web3Service.getTransactionReceipt(txHash);

      expect(receipt).toEqual({
        status: true,
        blockNumber: 12345,
        gasUsed: 21000,
        cumulativeGasUsed: undefined,
        logs: 0
      });
      expect(mockWeb3.eth.getTransactionReceipt).toHaveBeenCalledWith(txHash);
    });
  });

  describe("getContractInfo", () => {
    it("should get contract information", async () => {
      const contractAddress = "0x1234567890123456789012345678901234567890";
      const contractInfo = await web3Service.getContractInfo(contractAddress);

      expect(contractInfo).toEqual({
        name: "Test Token",
        symbol: "TEST",
        address: contractAddress,
        isContract: true
      });
    });

    it("should handle contract not found", async () => {
      const contractAddress = "0x1234567890123456789012345678901234567890";
      mockWeb3.eth.getCode.mockResolvedValue("0x");

      const contractInfo = await web3Service.getContractInfo(contractAddress);

      expect(contractInfo).toBeNull();
    });
  });

  describe("getTokenBalance", () => {
    it("should get token balance for address", async () => {
      const contractAddress = "0x1234567890123456789012345678901234567890";
      const walletAddress = "0x0987654321098765432109876543210987654321";

      const balance = await web3Service.getTokenBalance(
        contractAddress,
        walletAddress
      );

      expect(balance).toBe("100000000000000000000");
    });
  });

  describe("validateAddress", () => {
    it("should validate correct address format", () => {
      const address = "0x1234567890123456789012345678901234567890";

      const isValid = web3Service.validateAddress(address);

      expect(isValid).toBe(true);
      expect(mockWeb3.utils.isAddress).toHaveBeenCalledWith(address);
    });

    it("should reject invalid address format", () => {
      mockWeb3.utils.isAddress.mockReturnValue(false);
      const address = "invalid-address";

      const isValid = web3Service.validateAddress(address);

      expect(isValid).toBe(false);
    });
  });

  describe("formatEther", () => {
    it("should convert wei to ether", () => {
      const wei = "1000000000000000000";
      const ether = web3Service.formatEther(wei);

      expect(ether).toBe(1);
      expect(mockWeb3.utils.fromWei).toHaveBeenCalledWith(wei, "ether");
    });
  });

  describe("parseEther", () => {
    it("should convert ether to wei", () => {
      const ether = 1;
      const wei = web3Service.parseEther(ether);

      expect(wei).toBe(1000000000000000000);
      expect(mockWeb3.utils.toWei).toHaveBeenCalledWith("1", "ether");
    });
  });

  describe("isConnected", () => {
    it("should return true when connected", async () => {
      const isConnected = await web3Service.isConnected();

      expect(isConnected).toBe(true);
      expect(mockWeb3.eth.getBlockNumber).toHaveBeenCalled();
    });

    it("should return false when not connected", async () => {
      mockWeb3.eth.getBlockNumber.mockRejectedValue(
        new Error("Connection failed")
      );

      const isConnected = await web3Service.isConnected();

      expect(isConnected).toBe(false);
    });
  });
});
