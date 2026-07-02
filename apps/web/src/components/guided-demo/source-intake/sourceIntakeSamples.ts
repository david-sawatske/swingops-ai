import type {
  MultiSourceIntakeSourceInput,
  MultiSourceIntakeSourceType,
} from "../../../types/workflow";

export const SAMPLE_SOURCE_BY_TYPE: Record<
  MultiSourceIntakeSourceType,
  MultiSourceIntakeSourceInput
> = {
  FREE_TEXT: {
    sourceType: "FREE_TEXT",
    sourceName: "Counter notebook notes",
    rawContent: [
      "Sat counter notes - trade pile",
      "1) TM stealth2 drv 10.5 ventus stiff condition 8.0 Average cust: Mark R.",
      "2) Ping g425 irons 5-pw reg flex condition 7.0 Below Average needs manager look.",
      "3) Cleveland RTX 6 ZipCore wedge senior flex condition 9.0 Above Average value $72 serial CLV-001.",
      "4) Odyssey White Hot OG putter ladies flex condition 8.0 Average value $95 serial ODS-002.",
      "Store 104 / associate jules",
    ].join("\n"),
  },
  POORLY_FORMED_CSV: {
    sourceType: "POORLY_FORMED_CSV",
    sourceName: "Store export with broken rows",
    rawContent: [
      "brand|model,cat,shaft,condition_grade,value,store",
      "Titleist; TSR2; 3w ; Tensei S ; 8.0 Average ; $145 ; 104",
      "Cally,Rogue ST Max driver,HZRDUS X,7.0 Below Average,190,STORE-207",
      "PING|G425 irons|reg|6.0 Poor||104",
      "Cleveland|RTX 6 ZipCore wedge|Senior|9.0 Above Average|$72|104",
      "Odyssey|White Hot OG putter|Ladies|8.0 Average|$95|104",
      "Mizuno|JPX 923 Hot Metal irons|Tour X-Stiff|9.0 Above Average|$390|STORE-104",
      "PING|G430 Max driver|Tour X-Stiff|9.5 Mint|$240|STORE-207",
    ].join("\n"),
  },
  EMAIL: {
    sourceType: "EMAIL",
    sourceName: "Customer trade-in email",
    rawContent: [
      "From: Hannah Lee <hannah.lee@example.com>",
      "To: tradeins@swingops.example",
      "Subject: Trade values for two clubs",
      "",
      "Hi team, I am bringing in a Callaway Rogue ST Max 9 degree driver with HZRDUS x-stiff.",
      "Condition grade is 7.0 Below Average.",
      "Also a TaylorMade Stealth 2 10.5 driver with Ventus stiff and condition 8.0 Average.",
      "One more: Cleveland RTX 6 ZipCore wedge with Senior flex, condition 9.0 Above Average, estimated value 72.",
      "Also Odyssey White Hot OG putter with Ladies flex, condition 8.0 Average, value 95.",
      "Preferred store: 207",
    ].join("\n"),
  },
  LOG: {
    sourceType: "LOG",
    sourceName: "Import worker event log",
    rawContent: [
      "2026-05-18T14:33:02Z INFO import start store=104 batch=nightly_tradeins",
      "2026-05-18T14:33:04Z WARN malformed payload brand=Titleist model=TSR cat=3w shaft='Tensei S' condition='8.0 Average' value=145",
      "2026-05-18T14:33:07Z ERROR row=18 missing category payload={brand:'PING', model:'G425', condition:'6.0 Poor', notes:'irons 5-PW reg'}",
      "2026-05-18T14:33:11Z INFO normalized sku match Callaway Rogue ST Max driver store=207",
      "2026-05-18T14:33:14Z INFO normalized payload brand=Cleveland model=RTX 6 ZipCore cat=wedge shaft='Senior' condition='9.0 Above Average' value=72",
      "2026-05-18T14:33:18Z INFO normalized payload brand=Mizuno model=JPX 923 Hot Metal cat=irons shaft='Tour X-Stiff' condition='9.0 Above Average' value=390",
    ].join("\n"),
  },
};
