/**
 * List Soroswap testnet pools with liquidity + probe which pairs quote.
 * Run from packages/shared:  SOROSWAP_API_KEY=… pnpm dlx tsx scripts/soroswap-pools.mts
 */
const API = "https://api.soroswap.finance";
const KEY = process.env.SOROSWAP_API_KEY;
const TOKENS: Record<string, string> = {
  CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC: "XLM",
  CB3TLW74NBIOT3BUWOZ3TUM6RFDF6A4GVIRUQRQZABG5KPOUL4JJOV2F: "USDC",
  CCZGLAUBDKJSQK72QOZHVU7CUWKW45OZWYWCLL27AEK74U2OIBK6LXF2: "XTAR",
  CDDIA6HYANLPMDKBVQRIIXY3NA6S3TMHZFJUNPMBEJGZ5JSHN3E2TAUI: "XRP",
  CBRQHWJDLPYVR4BSVUUWJCZGG4N4FF3CUZKDGRVTE36FAWNEJZEMQRME: "ARST",
  CDBCM2JWK2ERIE6EAVAZJJW3P25U5S3FLNHJDY72AVSVAVTU4E6NAQ43: "AQUA",
  CBQDUWBOHS7P4TZIJ3KUPUZQOWMKJC6CQPPFEONSV3BH4X27YVEXWNOT: "EURC",
  CB7ICEHVRIRMF3CF6SIP2C2R3Z4E7WRPATT552QSVLIXZ5RSN6KLUDAE: "BTC",
  CAFLDVK2REIV6AWNCSTW4HVAGHJNCAROPLTXQYG23VSKL3PSUXEBHYAX: "BRL",
  CADHV5C672FOGEUMCGYO2D6VQME3Y3NAP2FZRYJGA3VMDNOL5NAWQI7R: "UXIV",
  CBSWSTWY2OR7322PIIRU6Q6CY3VMMBBL6GX7TO5JV2M6OS2CG5ZHN7FX: "CYON",
  CBGFKYQJYMZC7HNW7RGQQOUR2LP5HAAQ3MPHDENMBNKBKOEDIWXJADAT: "JAMN",
  CBV3JJ7CJK2J2YEJRM2HPFXT4GKBO574XEEVX6YL725R6CRARXITLDCH: "VEOF",
};
const label = (c: string) => TOKENS[c] ?? `${c.slice(0, 6)}…`;

const res = await fetch(`${API}/pools?network=testnet&protocol=soroswap`, {
  headers: { Authorization: `Bearer ${KEY}` },
});
if (!res.ok) {
  console.error("pools →", res.status, (await res.text()).slice(0, 200));
  process.exit(1);
}
const pools = (await res.json()) as any[];
console.log("total pools:", pools.length);
const withLiquidity = pools
  .map((p) => ({
    a: label(p.tokenA),
    b: label(p.tokenB),
    ra: Number(p.reserveA ?? 0) / 1e7,
    rb: Number(p.reserveB ?? 0) / 1e7,
  }))
  .filter((p) => p.ra > 0 && p.rb > 0)
  .sort((x, y) => y.ra + y.rb - (x.ra + x.rb));
for (const p of withLiquidity.slice(0, 20)) {
  console.log(`${p.a}/${p.b}: ${p.ra.toFixed(1)} / ${p.rb.toFixed(1)}`);
}
