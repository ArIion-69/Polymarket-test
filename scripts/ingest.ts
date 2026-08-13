import { runIngest } from "../src/lib/ingest";

runIngest()
  .then((result) => {
    console.log(`Done. Markets=${result.marketsCount}, news=${result.newsCount}`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
