const Transaction = require("../../../src/models/sql/Transaction");

describe("Transaction Model", () => {
  let transaction;
  let mockPool;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPool = {
      query: jest.fn()
    };

    transaction = new Transaction(mockPool);
  });

  describe("create", () => {
    it("should create a transaction successfully", async () => {
      const txData = {
        userId: 1,
        txHash: "0x1234567890abcdef",
        type: "transfer",
        amount: "100.0",
        status: "pending",
        blockNumber: 12345,
        gasUsed: 21000,
        gasPrice: "20000000000"
      };

      const mockResult = {
        rows: [
          {
            id: 1,
            user_id: 1,
            tx_hash: "0x1234567890abcdef",
            type: "transfer",
            amount: "100.0",
            status: "pending",
            block_number: 12345,
            gas_used: 21000,
            gas_price: "20000000000",
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      };

      mockPool.query.mockResolvedValue(mockResult);

      const result = await transaction.create(txData);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO transactions"),
        [
          1,
          "0x1234567890abcdef",
          "transfer",
          "100.0",
          "pending",
          12345,
          21000,
          "20000000000"
        ]
      );
      expect(result).toEqual(mockResult.rows[0]);
    });

    it("should create transaction with default values", async () => {
      const txData = {
        userId: 1,
        txHash: "0x1234567890abcdef",
        type: "transfer",
        amount: "100.0"
      };

      mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await transaction.create(txData);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO transactions"),
        [
          1,
          "0x1234567890abcdef",
          "transfer",
          "100.0",
          "pending",
          null,
          null,
          null
        ]
      );
    });

    it("should handle database errors", async () => {
      const txData = {
        userId: 1,
        txHash: "0x1234567890abcdef",
        type: "transfer",
        amount: "100.0"
      };

      const error = new Error("Database error");
      mockPool.query.mockRejectedValue(error);

      await expect(transaction.create(txData)).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("findByHash", () => {
    it("should find transaction by hash", async () => {
      const txHash = "0x1234567890abcdef";
      const mockResult = {
        rows: [
          {
            id: 1,
            tx_hash: txHash,
            type: "transfer",
            amount: "100.0"
          }
        ]
      };

      mockPool.query.mockResolvedValue(mockResult);

      const result = await transaction.findByHash(txHash);

      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM transactions WHERE tx_hash = $1",
        [txHash]
      );
      expect(result).toEqual(mockResult.rows[0]);
    });

    it("should return undefined when transaction not found", async () => {
      const txHash = "0x1234567890abcdef";
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await transaction.findByHash(txHash);

      expect(result).toBeUndefined();
    });
  });

  describe("findByUser", () => {
    it("should find transactions by user with pagination", async () => {
      const userId = 1;
      const limit = 10;
      const offset = 20;

      const mockResult = {
        rows: [
          { id: 1, tx_hash: "0x123", type: "transfer" },
          { id: 2, tx_hash: "0x456", type: "mint" }
        ]
      };

      mockPool.query.mockResolvedValue(mockResult);

      const result = await transaction.findByUser(userId, limit, offset);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM transactions"),
        [userId, limit, offset]
      );
      expect(result).toEqual(mockResult.rows);
    });

    it("should use default pagination values", async () => {
      const userId = 1;
      mockPool.query.mockResolvedValue({ rows: [] });

      await transaction.findByUser(userId);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM transactions"),
        [userId, 50, 0]
      );
    });
  });

  describe("updateStatus", () => {
    it("should update transaction status successfully", async () => {
      const txHash = "0x1234567890abcdef";
      const status = "confirmed";
      const blockNumber = 12345;

      const mockResult = {
        rows: [
          {
            id: 1,
            tx_hash: txHash,
            status: status,
            block_number: blockNumber,
            updated_at: new Date()
          }
        ]
      };

      mockPool.query.mockResolvedValue(mockResult);

      const result = await transaction.updateStatus(
        txHash,
        status,
        blockNumber
      );

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE transactions"),
        [status, blockNumber, txHash]
      );
      expect(result).toEqual(mockResult.rows[0]);
    });

    it("should update status without block number", async () => {
      const txHash = "0x1234567890abcdef";
      const status = "failed";

      mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await transaction.updateStatus(txHash, status);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE transactions"),
        [status, null, txHash]
      );
    });
  });

  describe("getPendingTransactions", () => {
    it("should get all pending transactions", async () => {
      const mockResult = {
        rows: [
          { id: 1, tx_hash: "0x123", status: "pending" },
          { id: 2, tx_hash: "0x456", status: "pending" }
        ]
      };

      mockPool.query.mockResolvedValue(mockResult);

      const result = await transaction.getPendingTransactions();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "SELECT * FROM transactions WHERE status = 'pending'"
        )
      );
      expect(result).toEqual(mockResult.rows);
    });
  });

  describe("getTransactionStats", () => {
    it("should get transaction statistics for user", async () => {
      const userId = 1;
      const mockResult = {
        rows: [
          {
            total_transactions: 10,
            confirmed_transactions: 8,
            pending_transactions: 1,
            failed_transactions: 1,
            total_amount: "1000.0"
          }
        ]
      };

      mockPool.query.mockResolvedValue(mockResult);

      const result = await transaction.getTransactionStats(userId);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT COUNT(*) as total_transactions"),
        [userId]
      );
      expect(result).toEqual(mockResult.rows[0]);
    });

    it("should handle user with no transactions", async () => {
      const userId = 999;
      const mockResult = {
        rows: [
          {
            total_transactions: 0,
            confirmed_transactions: 0,
            pending_transactions: 0,
            failed_transactions: 0,
            total_amount: null
          }
        ]
      };

      mockPool.query.mockResolvedValue(mockResult);

      const result = await transaction.getTransactionStats(userId);

      expect(result.total_transactions).toBe(0);
      expect(result.total_amount).toBeNull();
    });
  });

  describe("deleteTransaction", () => {
    it("should delete transaction by hash", async () => {
      const txHash = "0x1234567890abcdef";
      const mockResult = {
        rows: [{ id: 1, tx_hash: txHash }]
      };

      mockPool.query.mockResolvedValue(mockResult);

      const result = await transaction.deleteTransaction(txHash);

      expect(mockPool.query).toHaveBeenCalledWith(
        "DELETE FROM transactions WHERE tx_hash = $1 RETURNING *",
        [txHash]
      );
      expect(result).toEqual(mockResult.rows[0]);
    });

    it("should return undefined when transaction not found", async () => {
      const txHash = "0x1234567890abcdef";
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await transaction.deleteTransaction(txHash);

      expect(result).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should handle database connection errors", async () => {
      const error = new Error("Connection lost");
      mockPool.query.mockRejectedValue(error);

      await expect(transaction.findByHash("0x123")).rejects.toThrow(
        "Connection lost"
      );
    });

    it("should handle constraint violation errors", async () => {
      const error = new Error("duplicate key value violates unique constraint");
      error.code = "23505";
      mockPool.query.mockRejectedValue(error);

      await expect(
        transaction.create({
          userId: 1,
          txHash: "0x1234567890abcdef",
          type: "transfer",
          amount: "100.0"
        })
      ).rejects.toThrow("duplicate key value violates unique constraint");
    });
  });
});
