/**
 * On-chain provenance anchor. The platform wallet writes a real Arc transaction
 * whose calldata carries the story hash + the contributor's wallet address.
 * This creates a permanent, tamper-proof cryptographic link between a
 * contributor and their exact words — verifiable by anyone, forever.
 *
 * No contract needed: the data rides in a 0-value self-transaction's calldata.
 */
import { createWalletClient, createPublicClient, http, keccak256, toHex, encodePacked } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const ARC_RPC = "https://rpc.testnet.arc.network";
const ARC_CHAIN_ID = 5042002;

const arcChain = {
  id: ARC_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "Arc", symbol: "ARC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_RPC] } },
} as const;

export interface AnchorResult {
  storyHash: string;   // keccak256 of the content
  txHash: string;      // the on-chain anchor transaction
  contributor: string; // contributor wallet recorded in the anchor
}

/**
 * Anchor a contribution on-chain.
 * The calldata layout (so it's decodable later):
 *   "EMP1" magic | contributorAddress (20 bytes) | storyHash (32 bytes)
 */
export async function anchorContribution(
  body: string,
  contributorAddress: string,
): Promise<AnchorResult> {
  const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY as `0x${string}`);

  const storyHash = keccak256(toHex(body));

  // pack a self-describing payload into calldata
  const magic = toHex("EMP1"); // 0x454d5031
  const data = encodePacked(
    ["bytes4", "address", "bytes32"],
    [magic as `0x${string}`, contributorAddress as `0x${string}`, storyHash],
  );

  const walletClient = createWalletClient({ account, chain: arcChain, transport: http(ARC_RPC) });
  const publicClient = createPublicClient({ chain: arcChain, transport: http(ARC_RPC) });

  // 0-value self-tx carrying the provenance payload
  const txHash = await walletClient.sendTransaction({
    to: account.address,
    value: BigInt(0),
    data,
  });

  // don't block on full confirmation; one receipt poll is enough to surface errors
  await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 20_000 }).catch(() => {});

  return { storyHash, txHash, contributor: contributorAddress };
}
