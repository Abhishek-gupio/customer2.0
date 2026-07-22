import "dotenv/config";
import { dbInstances } from "@repo/db-customer";
import { parkingService } from "./src/modules/parking/parking.service";

const SLOT_WINDOW_ID = "cmrswxeap000unnutdnksw7bf";
const LISTING_ID = "cmrswv8ua000snnut94150y6g";
const DEALER_ID = "cmrswdfyc000lnnut75sd81nt";

async function main() {
  const before = await dbInstances.parkingSlotWindow.update({
    where: { id: SLOT_WINDOW_ID },
    data: { booked: { increment: 1 } },
  });
  console.log("Booked count after reserving 1:", before.booked);

  const testBooking = await dbInstances.parkingBooking.create({
    data: {
      customerId: "cmmontamk0000hkutthlz9kgo",
      listingId: LISTING_ID,
      slotWindowId: SLOT_WINDOW_ID,
      vehicleId: "cmnegwgzr000jqzut8nmw79gh",
      startTime: new Date(Date.now() - 3 * 3600_000), // 3h ago
      endTime: new Date(Date.now() - 2 * 3600_000), // 2h ago — already 2h overstayed
      amountPaise: 4000,
      status: "CONFIRMED",
      orderId: "order_checkout_race_test",
    },
  });
  console.log("Created CONFIRMED test booking (2h overstayed):", testBooking.id);

  try {
    // Two "racers" — simulating a dealer and an employee both tapping
    // checkout on the same booking within milliseconds of each other.
    const results = await Promise.allSettled([
      parkingService.checkoutBooking(DEALER_ID, testBooking.id),
      parkingService.checkoutBooking(DEALER_ID, testBooking.id),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    console.log(`Fulfilled: ${fulfilled.length}, Rejected: ${rejected.length}`);
    if (rejected.length) {
      console.log("Rejection reason:", (rejected[0] as PromiseRejectedResult).reason?.message);
    }

    const final = await dbInstances.parkingBooking.findUnique({ where: { id: testBooking.id } });
    console.log("Final booking state — extraOrderId:", final?.extraOrderId, "| extraAmountPaise:", final?.extraAmountPaise);

    const afterSlot = await dbInstances.parkingSlotWindow.findUnique({ where: { id: SLOT_WINDOW_ID } });
    console.log("Booked count after checkout race:", afterSlot?.booked, "(expected:", before.booked - 1, ")");

    if (
      fulfilled.length === 1 &&
      rejected.length === 1 &&
      final?.extraOrderId &&
      afterSlot?.booked === before.booked - 1
    ) {
      console.log("PASS — exactly one checkout won, exactly one overstay order created, capacity released exactly once.");
    } else {
      console.log("FAIL — expected exactly 1 winner, 1 overstay order, and a single capacity release.");
      process.exitCode = 1;
    }
  } finally {
    await dbInstances.parkingBooking.delete({ where: { id: testBooking.id } });
    const current = await dbInstances.parkingSlotWindow.findUnique({ where: { id: SLOT_WINDOW_ID } });
    if (current) {
      await dbInstances.parkingSlotWindow.update({
        where: { id: SLOT_WINDOW_ID },
        data: { booked: before.booked - 1 }, // restore to true original baseline
      });
    }
    console.log("Cleaned up test booking and restored booked count.");
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
