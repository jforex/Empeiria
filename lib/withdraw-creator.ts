/**
 * Creator withdrawal: move a creator's earned USDC out of their platform-custodied
 * wallet to a destination address they own, on Arc.
 *
 * Because a creator's wallet holds USDC but typically no native gas, the platform
 * sponsors a small gas top-up first, then the creator's wallet sends the USDC.
 * (Testnet, custodial-for-hackathon — flagged honestly in the README.)
 */
import { createWalletClient, createPublicClient, http, encodeFunctionData, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const ARC_RPC = "https://rpc.testnet.arc.network";
const ARC_CHAIN_ID = 5042002;
const USDC = "0x3600000000000000000000000000000000000000" as const;

const arcChain = {
  id: ARC_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "Arc", symbol: "ARC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_RPC] } },
} as const;

const ERC20_TRANSFER_ABI = [{
  name: "transfer", type: "function", stateMutability: "nonpayable",
  inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
  outputs: [{ name: "", type: "bool" }],
}] as const;

const ERC20_BALANCE_ABI = [{
  name: "balanceOf", type: "function", stateMutability: "view",
  inputs: [{ name: "account", type: "address" }],
  outputs: [{ name: "", type: "uint256" }],
}] as const;

export interface WithdrawResult {
  txHash: string;
  amount: string;
  to: string;
}

/** Read a wallet's USDC balance (in whole USDC). */
export async function usdcBalance(address: string): Promise<number> {
  const pub = createPublicClient({ chain: arcChain, transport: http(ARC_RPC) });
  const raw = await pub.readContract({ address: USDC, abi: ERC20_BALANCE_ABI, functionName: "balanceOf", args: [address as `0x${string}`] });
  return Number(raw) / 1_000_000;
}

/**
 * Withdraw `amount` USDC from the creator's custodied wallet to `destination`.
 * Platform sponsors gas to the creator wallet first if needed.
 */
/**
 * Pay a withdrawal from the platform treasury (which holds the pooled USDC)
 * to the creator's destination address. Custodial model: the creator's earnings
 * are a ledger claim on the treasury, settled on withdrawal. (Flagged in README.)
 */
export async function withdrawCreatorUsdc(
  _creatorPrivateKey: string,
  destination: string,
  amount: number,
): Promise<WithdrawResult> {
  const platformAccount = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY as `0x${string}`);
  const pub = createPublicClient({ chain: arcChain, transport: http(ARC_RPC) });
  const platformWallet = createWalletClient({ account: platformAccount, chain: arcChain, transport: http(ARC_RPC) });

  // platform treasury sends USDC directly to the creator's destination
  const data = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI, functionName: "transfer",
    args: [destination as `0x${string}`, parseUnits(amount.toString(), 6)],
  });
  const txHash = await platformWallet.sendTransaction({ to: USDC, data });
  await pub.waitForTransactionReceipt({ hash: txHash });

  return { txHash, amount: amount.toString(), to: destination };
}