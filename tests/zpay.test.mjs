import assert from "node:assert/strict";
import test from "node:test";
import { moneyFen, parseZpayQuery, signZpay, verifyZpay, zpayFields } from "../lib/zpay.ts";

test("ZPay signs decoded values in ASCII key order and rejects tampering", () => {
  const key = "test-only-secret";
  const fields = { type: "alipay", money: "39.00", name: "醒发 30天", out_trade_no: "abcd" };
  const signature = signZpay(fields, key);
  assert.equal(signature, signZpay({ out_trade_no: "abcd", name: "醒发 30天", money: "39.00", type: "alipay" }, key));
  assert.ok(verifyZpay({ ...fields, sign: signature, sign_type: "MD5" }, key));
  assert.equal(verifyZpay({ ...fields, money: "0.01", sign: signature, sign_type: "MD5" }, key), false);
  assert.equal(verifyZpay({ ...fields, sign: signature, sign_type: "SHA256" }, key), false);
});

test("ZPay checkout amount, notification address and duplicate parameters", () => {
  const fields = zpayFields({ pid: "test", key: "secret", cid: "channel", orderId: "a".repeat(32), amountFen: 14900, plan: "atelier", origin: "https://alreadough.com" });
  assert.equal(fields.money, "149.00");
  assert.equal(fields.notify_url, "https://alreadough.com/api/pay/zpay/notify");
  assert.ok(verifyZpay(fields, "secret"));
  assert.equal(parseZpayQuery("https://alreadough.com/api/pay/zpay/notify?money=39.00&money=0.01"), null);
  assert.equal(moneyFen("39.00"), 3900);
  assert.equal(moneyFen("39"), 3900);
  assert.equal(moneyFen("39.0"), 3900);
  assert.equal(moneyFen("39.001"), null);
  assert.equal(moneyFen("3e1"), null);
});
