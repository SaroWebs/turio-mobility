import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiRequest, API_V1_BASE } from "../utils/api";
import { useCustomerAuth } from "../contexts/customerAuth";
import { RideLocationInput } from "../components/customer/RideLocationInput";
import { LiveRideGoogleMap } from "../components/customer/LiveRideGoogleMap";
import { PageContainer, PageHeading } from "../components/customer";
import type { LocationSearchResult } from "../utils/customerApi";

type Rules = {
  payment_methods: string[]; no_show_refund_bps?: number;
  fee_bps: number;
  fee_fixed_minor: number;
  cancellation: { free_hours: number; late_refund_bps: number };
};
type Pricing = {
  version: number;
  region: string;
  source: string;
  fuel_minor: number;
  toll_minor: number;
  suggested_minor: number;
  max_seat_minor: number;
  max_total_minor: number;
  driver_min_minor: number;
  rules: Rules;
};
type Ride = {
  id: number;
  status: string;
  origin: string;
  destination: string;
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
  departure_at: string;
  timezone: string;
  distance_m: number;
  duration_minutes: number;
  seats: number;
  remaining_seats: number;
  price_minor: number;
  currency: string;
  booking_mode: string;
  luggage: string;
  notes: string;
  preferences: { smoking: boolean; pets: boolean; ac: boolean };
  pricing_snapshot: Pricing;
  policy_version: number;
  driver: {
    name: string;
    verified: boolean;
    rating: number | null;
    completed_trips: number;
    reviews: { rating: number; body: string }[];
  };
  vehicle: { make: string; model: string };
  bookings?: Booking[];
  meeting?: { pickup: string; dropoff: string; instructions: string };
  vehicle_id?: number;
};
type Booking = {
  id: number;
  status: string;
  seats: number;
  ride: Ride;
  total_minor: number;
  contribution_minor: number;
  fee_minor: number;
  currency: string;
  payment_method: string;
  payment_status: string;
  refund_status: string;
  payout_status: string;
  expires_at: string | null;
  meeting?: { pickup: string; dropoff: string; instructions: string };
  contact?: string;
  pin?: string;
  checked_in_at: string | null;
  attendance: string;
};
type Options = {
  can_offer: boolean;
  policies: { region: string; currency: string; rules: Rules }[];
  vehicles: { id: number; make: string; model: string; seats: number }[];
  online_available: boolean;
  test_payments: boolean;
};
type Mine = { offered: Ride[]; bookings: Booking[] };
const panel =
  "rounded-2xl border border-[#dbe1dc] bg-white p-5 sm:p-6 space-y-4";
const button =
  "min-h-11 rounded-xl bg-[#0d7769] px-5 py-2 text-white font-semibold disabled:opacity-50";
const secondary =
  "min-h-11 rounded-xl border border-[#b8c9c2] px-4 py-2 text-[#13231f] disabled:opacity-50";
const input =
  "min-h-11 w-full rounded-lg border border-[#b8c9c2] bg-white px-3 py-2";
const newRequestKey = () =>
  globalThis.crypto?.randomUUID?.() ??
  `carpool-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const baseUrl = API_V1_BASE.replace(/\/v1$/, "/carpool");
async function request<T>(
  path: string,
  method = "GET",
  data?: unknown,
  key?: string,
): Promise<T> {
  const result = await apiRequest<{ data: T }>(
    path,
    {
      method,
      body: data === undefined ? undefined : JSON.stringify(data),
      headers: key ? { "Idempotency-Key": key } : undefined,
    },
    { baseUrl },
  );
  if (result.error || !result.data)
    throw new Error(result.error || "Unable to load carpool information.");
  return result.data.data;
}
const money = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
    value / 100,
  );
const departure = (ride: Ride) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: ride.timezone,
  }).format(new Date(ride.departure_at));
const arrival = (ride: Ride) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: ride.timezone,
  }).format(new Date(new Date(ride.departure_at).getTime() + ride.duration_minutes * 60_000));
const duration = (minutes: number) =>
  `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}h ` : ""}${minutes % 60}m`;

export function CarpoolPage() {
  const { isAuthenticated, openAuthModal } = useCustomerAuth();
  const [tab, setTab] = useState("find");
  const [options, setOptions] = useState<Options | null>(null);
  const [mine, setMine] = useState<Mine>({ offered: [], bookings: [] });
  const [rides, setRides] = useState<Ride[]>([]);
  const [selected, setSelected] = useState<Ride | null>(null);
  const [editing, setEditing] = useState<Ride | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [seats, setSeats] = useState(1);
  const [payment, setPayment] = useState("cash");
  const [accepted, setAccepted] = useState(false);
  const [bookingKey, setBookingKey] = useState(() => newRequestKey());
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [from, setFrom] = useState<LocationSearchResult | null>(null);
  const [to, setTo] = useState<LocationSearchResult | null>(null);
  const searchForm = useRef<HTMLFormElement>(null);
  const searchSequence = useRef(0);
  const [filterRevision, setFilterRevision] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  function invalidateSearch() {
    searchSequence.current += 1;
    setFilterRevision((value) => value + 1);
    setRides([]);
    setSelected(null);
    setSearched(false);
    setSearching(false);
    setSearchError("");
  }

  const searchRides = useCallback(async () => {
    const form = searchForm.current;
    if (!form || !origin.trim() || !destination.trim() || !form.checkValidity()) return;
    const sequence = ++searchSequence.current;
    const query = new URLSearchParams();
    new FormData(form).forEach((v, k) => {
      if (v) query.set(k, String(v));
    });
    if (query.has("max_price"))
      query.set("max_price", String(Math.round(Number(query.get("max_price")) * 100)));
    query.set("seats", String(seats));
    query.set("origin", origin.trim());
    query.set("destination", destination.trim());
    if (from?.lat != null && from.lng != null) {
      query.set("origin_lat", String(from.lat));
      query.set("origin_lng", String(from.lng));
    }
    if (to?.lat != null && to.lng != null) {
      query.set("destination_lat", String(to.lat));
      query.set("destination_lng", String(to.lng));
    }
    setSearching(true);
    setSearchError("");
    setSearched(false);
    setRides([]);
    setSelected(null);
    try {
      const results = await request<Ride[]>(`/rides?${query}`);
      if (sequence !== searchSequence.current) return;
      setRides(results);
      setSearched(true);
    } catch (e) {
      if (sequence === searchSequence.current)
        setSearchError(e instanceof Error ? e.message : "Unable to find trips. Please retry.");
    } finally {
      if (sequence === searchSequence.current) setSearching(false);
    }
  }, [origin, destination, from, to, seats]);

  useEffect(() => {
    if (tab !== "find") return;
    const timer = window.setTimeout(() => { void searchRides(); }, 400);
    return () => {
      window.clearTimeout(timer);
      searchSequence.current += 1;
    };
  }, [searchRides, filterRevision, tab]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    request<Options>("/options")
      .then((data) => {
        if (active) setOptions(data);
      })
      .catch((e) => {
        if (active) setError(String(e.message));
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Something went wrong. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    setMine(await request<Mine>("/mine"));
  }
  function changeTab(next: string) {
    if (next !== "find" && !isAuthenticated) {
      openAuthModal("/rides/carpool");
      return;
    }
    setTab(next);
    setSelected(null);
    setError("");
    setMessage("");
    if (next === "offered" || next === "bookings") void run(refresh);
  }
  function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void searchRides();
  }
  async function book() {
    if (!isAuthenticated) {
      openAuthModal("/rides/carpool");
      return;
    }
    if (!selected) return;
    await request(
      `/rides/${selected.id}/book`,
      "POST",
      {
        seats,
        payment_method: payment,
        policy_version: selected.policy_version,
        price_minor: selected.price_minor,
        accept_terms: accepted,
      },
      bookingKey,
    );
    setSelected(null);
    setTab("bookings");
    await refresh();
    setMessage(
      "Your booking was saved. Review its status and next steps below.",
    );
  }
  async function act(
    kind: string,
    id: number,
    action: string,
    data: unknown = {},
  ) {
    await request(`/${kind}/${id}/${action}`, "POST", data);
    await refresh();
    setMessage("Updated successfully.");
  }
  function choose(ride: Ride) {
    setSelected(ride);
    setAccepted(false);
    setBookingKey(newRequestKey());
    setPayment(ride.pricing_snapshot.rules.payment_methods[0] || "cash");
  }

  function bookingCard(b: Booking, driver = false) {
    return (
      <article className={panel} key={b.id}>
        <h3 className="font-semibold">
          Booking #{b.id} · {b.ride.origin} → {b.ride.destination}
        </h3>
        <p>
          {departure(b.ride)} ({b.ride.timezone}) · {b.seats} seat(s)
        </p>
        <p>
          <strong>{b.status}</strong> · Payment: {b.payment_status} (
          {b.payment_method}) · Refund: {b.refund_status} · Payout:{" "}
          {b.payout_status}
        </p>
        <p>
          Contribution {money(b.contribution_minor, b.currency)} + fee{" "}
          {money(b.fee_minor, b.currency)} ={" "}
          <strong>{money(b.total_minor, b.currency)}</strong>
        </p>
        {b.expires_at && ["requested", "reserved"].includes(b.status) && (
          <p>
            Deadline: {new Date(b.expires_at).toLocaleString()}.{" "}
            {b.status === "requested"
              ? "Seats are checked again on approval."
              : "Complete payment before this hold expires."}
          </p>
        )}
        {b.meeting && (
          <div className="rounded-xl bg-[#edf5f1] p-4">
            <p>Meet: {b.meeting.pickup}</p>
            <p>Drop-off: {b.meeting.dropoff}</p>
            <p>{b.meeting.instructions}</p>
            <p>
              Participant contact: <a href={`tel:${b.contact}`}>{b.contact}</a>
            </p>
            {b.pin && (
              <p>
                Your trip PIN: <strong>{b.pin}</strong>. Share with your driver
                at check-in.
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {driver && b.status === "requested" && (
            <>
              <button
                className={button}
                disabled={busy}
                onClick={() => void run(() => act("bookings", b.id, "approve"))}
              >
                Approve request
              </button>
              <button
                className={secondary}
                disabled={busy}
                onClick={() => void run(() => act("bookings", b.id, "reject"))}
              >
                Reject
              </button>
            </>
          )}
          {!driver &&
            ["requested", "reserved", "confirmed"].includes(b.status) &&
            b.ride.status === "published" && (
              <button
                className={secondary}
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Cancel this booking under the accepted cancellation policy?",
                    )
                  )
                    void run(() => act("bookings", b.id, "cancel"));
                }}
              >
                Cancel booking
              </button>
            )}
          {!driver && b.status === "reserved" && (
            <button
              className={button}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (options?.test_payments) {
                    await act("bookings", b.id, "test-payment");
                    setMessage("Test payment captured. No money moved.");
                    return;
                  }
                  const order = await request<{
                    order_id: string;
                    amount: number;
                    currency: string;
                    key: string;
                  }>(`/bookings/${b.id}/checkout`, "POST");
                  await openCheckout(order);
                  setMessage(
                    "Payment submitted. Refresh to check the verified payment status.",
                  );
                  await refresh();
                })
              }
            >
              {options?.test_payments
                ? "Pay in test mode"
                : "Complete online payment"}
            </button>
          )}
          {driver && b.status === "confirmed" && !b.checked_in_at && (
            <button
              className={secondary}
              disabled={busy}
              onClick={() => {
                const pin = window.prompt(
                  "Enter the passenger’s six-digit PIN at pickup",
                );
                if (pin)
                  void run(() => act("bookings", b.id, "check-in", { pin }));
              }}
            >
              Check in with PIN
            </button>
          )}
          {driver && b.status === "confirmed" && !b.checked_in_at && (
            <button
              className={secondary}
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Mark this passenger as a no-show after the waiting period?",
                  )
                )
                  void run(() => act("bookings", b.id, "no-show"));
              }}
            >
              Mark no-show
            </button>
          )}
          {driver &&
            b.ride.status === "completed" &&
            b.checked_in_at &&
            b.payment_method === "cash" &&
            b.payment_status !== "collected" && (
              <button
                className={secondary}
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Confirm cash was received directly from this passenger?",
                    )
                  )
                    void run(() => act("bookings", b.id, "cash-collected"));
                }}
              >
                Record cash received
              </button>
            )}
        </div>
        {b.ride.status === "completed" && b.checked_in_at && (
          <form
            className="flex flex-wrap gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              void run(() =>
                act("bookings", b.id, "review", {
                  rating: Number(d.get("rating")),
                  body: d.get("body"),
                }),
              );
            }}
          >
            <label>
              Rating
              <select name="rating" className={input}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="grow">
              Review
              <input name="body" required maxLength={2000} className={input} />
            </label>
            <button disabled={busy} className={secondary}>
              Publish review
            </button>
          </form>
        )}
        <details>
          <summary className="cursor-pointer py-2">
            Report a problem, review, or payment dispute
          </summary>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const body = new FormData(e.currentTarget).get("body");
              void run(() => act("bookings", b.id, "complaint", { body }));
            }}
          >
            <label>
              Describe the issue
              <textarea
                name="body"
                className={input}
                required
                maxLength={4000}
              />
            </label>
            <button disabled={busy} className={secondary}>
              Send to support
            </button>
          </form>
        </details>
      </article>
    );
  }

  return (
    <PageContainer as="main" className="py-8 sm:py-12">
      <Link to="/rides" className="underline">
        ← Fast rides
      </Link>
      <PageHeading
        eyebrow="Intercity · Cost sharing"
        title="Go the same way. Share the journey."
        description="Find a seat with a driver already making the trip. Contributions help cover fuel and tolls."
      />
      <nav className="my-6 flex flex-wrap gap-2" aria-label="Carpool">
        <button
          className={tab === "find" ? button : secondary}
          onClick={() => changeTab("find")}
        >
          Find a ride
        </button>
        <button
          className={tab === "offer" ? button : secondary}
          onClick={() => {
            setEditing(null);
            changeTab("offer");
          }}
        >
          Offer a ride
        </button>
        <button
          className={tab === "offered" ? button : secondary}
          onClick={() => changeTab("offered")}
        >
          My offered rides
        </button>
        <button
          className={tab === "bookings" ? button : secondary}
          onClick={() => changeTab("bookings")}
        >
          My bookings
        </button>
      </nav>
      {error && (
        <p className="my-4 rounded-xl bg-red-50 p-4 text-red-800" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="my-4 rounded-xl bg-[#edf5f1] p-4" role="status">
          {message}
        </p>
      )}
      {busy && (
        <p role="status" className="my-3">
          Updating carpool information…
        </p>
      )}
      {tab === "find" && (
        <div className="space-y-6">
          <form id="carpool-search" ref={searchForm} onSubmit={search} onChange={invalidateSearch} className={panel}>
            <div className="grid gap-4 md:grid-cols-2">
              <RideLocationInput
                kind="pickup"
                value={origin}
                onChange={(v) => {
                  setOrigin(v);
                  setFrom(null);
                }}
                onSelect={(p) => {
                  invalidateSearch();
                  setOrigin(p.name);
                  setFrom(p);
                }}
              />
              <RideLocationInput
                kind="dropoff"
                value={destination}
                onChange={(v) => {
                  setDestination(v);
                  setTo(null);
                }}
                onSelect={(p) => {
                  invalidateSearch();
                  setDestination(p.name);
                  setTo(p);
                }}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <label>
                Travel date (departure timezone)
                <input className={input} type="date" name="date" />
              </label>
              <label>
                Seats
                <input
                  className={input}
                  type="number"
                  min="1"
                  max="12"
                  value={seats}
                  onChange={(e) => {
                    setSeats(Number(e.target.value));
                    setSelected(null);
                  }}
                  required
                />
              </label>
              <label>
                Sort
                <select name="sort" className={input}>
                  <option value="departure">Departure time</option>
                  <option value="price">Lowest total</option>
                  <option value="seats">Most seats</option>
                  <option value="rating">Driver rating</option>
                </select>
              </label>
            </div>
            <details>
              <summary className="cursor-pointer py-2">More filters</summary>
              <div className="grid gap-4 sm:grid-cols-3">
                <label>
                  Currency
                  <select name="currency" className={input}>
                    <option value="">All currencies (prices grouped)</option>
                    {["INR", "USD", "EUR", "GBP", "AUD", "CAD", "SGD"].map(
                      (c) => (
                        <option key={c}>{c}</option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Maximum contribution per seat
                  <input
                    name="max_price"
                    type="number"
                    min="0"
                    step="0.01"
                    className={input}
                  />
                </label>
                <label>
                  Depart after
                  <input type="time" name="after_time" className={input} />
                </label>
                <label>
                  Minimum driver rating
                  <select name="min_rating" className={input}>
                    <option value="">Any</option>
                    <option>3</option>
                    <option>4</option>
                    <option>5</option>
                  </select>
                </label>
                <label>
                  <input type="checkbox" name="instant" value="1" /> Instant
                  booking
                </label>
                <label>
                  <input type="checkbox" name="verified" value="1" /> Verified
                  driver
                </label>
                <label>
                  <input type="checkbox" name="ac" value="1" /> Air conditioning
                </label>
                <label>
                  <input type="checkbox" name="pets" value="1" /> Pets allowed
                </label>
                <label>
                  <input type="checkbox" name="smoking" value="0" /> No smoking
                </label>
              </div>
            </details>
            <p className="text-sm">
              Full-route bookings only. Nearby endpoint matching does not
              include intermediate pickups. Exact meeting instructions appear
              after confirmation.
            </p>
          </form>
          <div aria-live="polite" aria-atomic="true">
            {searching ? <p role="status">Searching available trips…</p> : searched ? (
              <h2 className="text-xl font-semibold">Available trips ({rides.length})</h2>
            ) : !searchError ? <p>Enter your origin and destination to see available trips and timings.</p> : null}
          </div>
          {searchError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{searchError}</p>}
          {searched && rides.length === 0 && (
            <div className={panel}>
              <h2 className="font-semibold">No matching rides yet</h2>
              <p>
                Try another date or fewer filters. Carpool is available only in
                enabled regions.
              </p>
            </div>
          )}
          <div className="grid gap-5 lg:grid-cols-2">
            {rides.map((ride) => (
              <article className={panel} key={ride.id}>
                <p className="text-sm font-semibold text-[#0d7769]">
                  CARPOOL ·{" "}
                  {ride.booking_mode === "instant"
                    ? "Instant booking"
                    : "Driver approval"}
                </p>
                <h2 className="text-xl font-semibold">
                  {ride.origin} → {ride.destination}
                </h2>
                <dl className="grid gap-3 rounded-xl bg-[#edf5f1] p-4 sm:grid-cols-2">
                  <div><dt className="text-sm">Departure</dt><dd className="font-semibold">{departure(ride)}</dd></div>
                  <div><dt className="text-sm">Estimated arrival</dt><dd className="font-semibold">{arrival(ride)}</dd></div>
                </dl>
                <p className="text-sm">{duration(ride.duration_minutes)} journey · Times in {ride.timezone}</p>
                <p>
                  {ride.driver.name}{" "}
                  {ride.driver.verified ? "· Verified driver" : ""} ·{" "}
                  {ride.driver.rating
                    ? `${Number(ride.driver.rating).toFixed(1)} / 5`
                    : "No reviews yet"}{" "}
                  · {ride.driver.completed_trips} completed carpools
                </p>
                <p>
                  {ride.vehicle.make} {ride.vehicle.model} ·{" "}
                  {ride.remaining_seats} seats left · {ride.luggage}
                </p>
                <p>
                  {money(ride.price_minor, ride.currency)} contribution per seat
                </p>
                <button className={secondary} onClick={() => choose(ride)}>
                  View ride and contribution
                </button>
              </article>
            ))}
          </div>
          <div className="flex justify-center border-t border-[#dbe1dc] pt-5">
            <button type="submit" form="carpool-search" className={`${button} w-full sm:w-auto`} disabled={searching || !origin.trim() || !destination.trim()}>
              {searching ? "Searching…" : "Search car"}
            </button>
          </div>
          {selected && (
            <section className={panel} aria-label="Ride details">
              <h2 className="text-2xl font-semibold">
                {selected.origin} → {selected.destination}
              </h2>
              <p>
                {departure(selected)} · {Math.round(selected.distance_m / 1000)}{" "}
                km · about {selected.duration_minutes} minutes
              </p>
              <p>
                Pickup area: {selected.origin}. Drop-off area:{" "}
                {selected.destination}.
              </p>
              <LiveRideGoogleMap
                pickup={{
                  latitude: Number(selected.origin_lat),
                  longitude: Number(selected.origin_lng),
                }}
                dropoff={{
                  latitude: Number(selected.destination_lat),
                  longitude: Number(selected.destination_lng),
                }}
                status="Full carpool route"
              />
              <p>
                Luggage: {selected.luggage} · Smoking{" "}
                {selected.preferences.smoking ? "allowed" : "not allowed"} ·
                Pets {selected.preferences.pets ? "allowed" : "not allowed"} ·
                AC {selected.preferences.ac ? "available" : "unavailable"}
              </p>
              <Pricing ride={selected} seats={seats} />
              <p>
                Cancellation: full refund at least{" "}
                {selected.pricing_snapshot.rules.cancellation.free_hours} hours
                before departure; later cancellations refund{" "}
                {selected.pricing_snapshot.rules.cancellation.late_refund_bps /
                  100}
                % of online payment. Driver cancellation refunds the full online
                payment. No-shows refund {(selected.pricing_snapshot.rules.no_show_refund_bps ?? 10000) / 100}% of online payment. Cash is paid directly to the driver.
              </p>
              {selected.driver.reviews.map((review, i) => (
                <blockquote className="border-l-2 pl-3" key={i}>
                  {review.rating}/5 — {review.body}
                </blockquote>
              ))}
              <label>
                Payment method
                <select
                  className={input}
                  value={payment}
                  onChange={(e) => {
                    setPayment(e.target.value);
                    setBookingKey(newRequestKey());
                  }}
                >
                  {selected.pricing_snapshot.rules.payment_methods.map(
                    (method) => (
                      <option
                        key={method}
                        value={method}
                        disabled={
                          method === "online" &&
                          options !== null &&
                          !options.online_available
                        }
                      >
                        {method === "cash"
                          ? "Cash directly to driver"
                          : "Online payment after approval / reservation"}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-1"
                />
                I accept this contribution, cancellation policy, full-route
                booking, and meeting arrangement.
              </label>
              <button
                className={button}
                disabled={busy || !accepted}
                onClick={() => void run(book)}
              >
                {selected.booking_mode === "approval"
                  ? "Request seats"
                  : "Reserve seats"}
              </button>
              <button className={secondary} onClick={() => setSelected(null)}>
                Close details
              </button>
            </section>
          )}
        </div>
      )}
      {tab === "offer" && (
        <OfferForm
          key={editing?.id ?? "new"}
          options={options}
          initial={editing}
          busy={busy}
          submit={(data) =>
            void run(async () => {
              const saved = await request<Ride>(
                editing ? `/rides/${editing.id}` : "/rides",
                editing ? "PUT" : "POST",
                data,
              );
              setEditing(saved);
              setMessage(
                saved.status === "draft"
                  ? "Draft saved. Review the server-calculated contribution below, then publish."
                  : "Your ride is published.",
              );
              if (saved.status === "published") {
                setTab("offered");
                await refresh();
              }
            })
          }
        />
      )}
      {tab === "offer" && editing && (
        <div className="mt-5">
          <Pricing ride={editing} seats={1} />
        </div>
      )}
      {tab === "bookings" && (
        <div className="space-y-4">
          <button
            className={secondary}
            disabled={busy}
            onClick={() => void run(refresh)}
          >
            Refresh bookings
          </button>
          {!busy && !mine.bookings.length && (
            <p>No carpool bookings yet. Find a ride to get started.</p>
          )}
          {mine.bookings.map((b) => bookingCard(b))}
        </div>
      )}
      {tab === "offered" && (
        <div className="space-y-6">
          <button
            className={secondary}
            disabled={busy}
            onClick={() => void run(refresh)}
          >
            Refresh rides and requests
          </button>
          {!busy && !mine.offered.length && (
            <p>You have not offered a carpool ride yet.</p>
          )}
          {mine.offered.map((ride) => (
            <section className={panel} key={ride.id}>
              <h2 className="text-xl font-semibold">
                {ride.origin} → {ride.destination}
              </h2>
              <p>
                {departure(ride)} · {ride.status} · {ride.remaining_seats} seats
                remaining
              </p>
              <div className="flex flex-wrap gap-2">
                {["draft", "published"].includes(ride.status) && (
                  <>
                    <button
                      className={secondary}
                      disabled={Boolean(ride.bookings?.length)}
                      onClick={() => {
                        setEditing(ride);
                        setTab("offer");
                      }}
                    >
                      Edit / preview
                    </button>
                    <button
                      className={secondary}
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Cancel this trip? All passengers will be notified and applicable refunds queued.",
                          )
                        )
                          void run(() => act("rides", ride.id, "cancel"));
                      }}
                    >
                      Cancel ride
                    </button>
                  </>
                )}
                {ride.status === "published" && (
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() =>
                      void run(() => act("rides", ride.id, "start"))
                    }
                  >
                    Start trip
                  </button>
                )}
                {ride.status === "in_progress" && (
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() =>
                      void run(() => act("rides", ride.id, "complete"))
                    }
                  >
                    Complete trip
                  </button>
                )}
              </div>
              {Boolean(ride.bookings?.length) && (
                <p className="text-sm">
                  Route, time, price, and capacity are locked because bookings
                  exist. Cancel and publish a replacement for material changes.
                </p>
              )}
              {ride.bookings?.map((b) => bookingCard(b, true))}
            </section>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function Pricing({ ride, seats }: { ride: Ride; seats: number }) {
  const p = ride.pricing_snapshot;
  const contribution = ride.price_minor * seats;
  const fee =
    Math.ceil((contribution * p.rules.fee_bps) / 10000) +
    p.rules.fee_fixed_minor;
  return (
    <div className="space-y-2 rounded-xl bg-[#edf5f1] p-4">
      <h3 className="font-semibold">Transparent cost sharing</h3>
      <p>{p.source}</p>
      <p>
        Fuel estimate {money(p.fuel_minor, ride.currency)} · Tolls{" "}
        {money(p.toll_minor, ride.currency)}
      </p>
      <p>
        Driver minimum {money(p.driver_min_minor, ride.currency)} · Suggested
        per seat {money(p.suggested_minor, ride.currency)}
      </p>
      <p>
        Per-seat cap {money(p.max_seat_minor, ride.currency)} · Trip passenger
        cap {money(p.max_total_minor, ride.currency)}
      </p>
      <p>
        {seats} seat(s): contribution {money(contribution, ride.currency)} +
        platform fee {money(fee, ride.currency)} ={" "}
        <strong>{money(contribution + fee, ride.currency)}</strong>
      </p>
      <p className="text-sm">
        Policy version {p.version}. Confirmed contributions never increase if
        fewer passengers join.
      </p>
    </div>
  );
}

function OfferForm({
  options,
  initial,
  busy,
  submit,
}: {
  options: Options | null;
  initial: Ride | null;
  busy: boolean;
  submit: (data: unknown) => void;
}) {
  const [from, setFrom] = useState<LocationSearchResult | null>(null);
  const [to, setTo] = useState<LocationSearchResult | null>(null);
  const [origin, setOrigin] = useState(initial?.origin ?? "");
  const [destination, setDestination] = useState(initial?.destination ?? "");
  if (!options)
    return <p role="status">Loading eligibility and regional settings…</p>;
  if (!options.can_offer)
    return (
      <div className={panel}>
        <h2 className="font-semibold">Driver verification required</h2>
        <p>
          Register and verify your driver account and vehicle through the
          existing driver app. Use the same verified phone number in both
          accounts to offer rides here.
        </p>
      </div>
    );
  if (!options.policies.length)
    return (
      <p>
        Carpool markets are not enabled yet. An administrator must review and
        activate a regional policy.
      </p>
    );
  return (
    <form
      className={panel}
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const action =
          (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ||
          "draft";
        const n = (key: string) => Number(f.get(key));
        const date = new Date(String(f.get("departure_at")));
        submit({
          region: f.get("region"),
          vehicle_id: n("vehicle_id"),
          status: action,
          origin,
          destination,
          origin_lat:
            from?.lat ??
            (origin === initial?.origin ? initial.origin_lat : null),
          origin_lng:
            from?.lng ??
            (origin === initial?.origin ? initial.origin_lng : null),
          destination_lat:
            to?.lat ??
            (destination === initial?.destination
              ? initial.destination_lat
              : null),
          destination_lng:
            to?.lng ??
            (destination === initial?.destination
              ? initial.destination_lng
              : null),
          departure_at: date.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          distance_m: Math.round(n("distance") * 1000),
          duration_minutes: n("duration_minutes"),
          seats: n("seats"),
          price_minor: Math.round(n("price_minor") * 100),
          toll_minor: Math.round(n("toll_minor") * 100),
          meeting: {
            pickup: f.get("pickup"),
            dropoff: f.get("dropoff"),
            instructions: f.get("instructions"),
          },
          booking_mode: f.get("booking_mode"),
          luggage: f.get("luggage"),
          notes: f.get("notes"),
          preferences: {
            smoking: f.has("smoking"),
            pets: f.has("pets"),
            ac: f.has("ac"),
          },
        });
      }}
    >
      <h2 className="text-xl font-semibold">
        {initial
          ? "Review your offered ride"
          : "Offer empty seats on your trip"}
      </h2>
      <p>
        Use verified route estimates. Distance and tolls are declared estimates
        checked against regional limits.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          Region
          <select
            className={input}
            name="region"
            defaultValue={initial?.pricing_snapshot.region}
          >
            {options.policies.map((p) => (
              <option key={p.region} value={p.region}>
                {p.region} ({p.currency})
              </option>
            ))}
          </select>
        </label>
        <label>
          Registered vehicle
          <select
            className={input}
            name="vehicle_id"
            required
            defaultValue={initial?.vehicle_id}
          >
            {options.vehicles.map((v) => (
              <option value={v.id} key={v.id}>
                {v.make} {v.model} · {v.seats - 1} passenger seats
              </option>
            ))}
          </select>
        </label>
        <RideLocationInput
          kind="pickup"
          value={origin}
          onChange={(v) => {
            setOrigin(v);
            setFrom(null);
          }}
          onSelect={(p) => {
            setOrigin(p.name);
            setFrom(p);
          }}
        />
        <RideLocationInput
          kind="dropoff"
          value={destination}
          onChange={(v) => {
            setDestination(v);
            setTo(null);
          }}
          onSelect={(p) => {
            setDestination(p.name);
            setTo(p);
          }}
        />
        <label>
          Departure ({Intl.DateTimeFormat().resolvedOptions().timeZone})
          <input
            name="departure_at"
            type="datetime-local"
            className={input}
            required
            defaultValue={
              initial
                ? new Date(
                    new Date(initial.departure_at).getTime() -
                      new Date(initial.departure_at).getTimezoneOffset() *
                        60000,
                  )
                    .toISOString()
                    .slice(0, 16)
                : ""
            }
          />
        </label>
        <label>
          Booking mode
          <select
            name="booking_mode"
            className={input}
            defaultValue={initial?.booking_mode}
          >
            <option value="approval">Approve requests first</option>
            <option value="instant">Instant booking</option>
          </select>
        </label>
        {[
          {
            name: "distance",
            label: "Estimated road distance (km)",
            value: initial ? initial.distance_m / 1000 : "",
            min: 1,
          },
          {
            name: "duration_minutes",
            label: "Estimated duration (minutes)",
            value: initial?.duration_minutes ?? "",
            min: 15,
          },
          {
            name: "seats",
            label: "Passenger seats offered (excluding driver)",
            value: initial?.seats ?? 1,
            min: 1,
          },
          {
            name: "price_minor",
            label: "Contribution per seat (regional currency)",
            value: initial ? initial.price_minor / 100 : 0.01,
            min: 0.01,
          },
          {
            name: "toll_minor",
            label: "Estimated tolls (regional currency)",
            value: initial ? initial.pricing_snapshot.toll_minor / 100 : 0,
            min: 0,
          },
        ].map((field) => (
          <label key={field.name}>
            {field.label}
            <input
              name={field.name}
              className={input}
              type="number"
              step={
                field.name === "distance"
                  ? "0.001"
                  : ["price_minor", "toll_minor"].includes(field.name)
                    ? "0.01"
                    : "1"
              }
              min={field.min}
              required
              defaultValue={field.value}
            />
          </label>
        ))}
        <label>
          Luggage allowance
          <input
            name="luggage"
            className={input}
            required
            maxLength={255}
            defaultValue={initial?.luggage}
            placeholder="One small bag per passenger"
          />
        </label>
        <label>
          Exact pickup point
          <input
            name="pickup"
            className={input}
            required
            maxLength={500}
            defaultValue={initial?.meeting?.pickup}
          />
        </label>
        <label>
          Exact drop-off point
          <input
            name="dropoff"
            className={input}
            required
            maxLength={500}
            defaultValue={initial?.meeting?.dropoff}
          />
        </label>
      </div>
      <label className="block">
        Meeting instructions
        <textarea
          name="instructions"
          className={input}
          maxLength={1500}
          defaultValue={initial?.meeting?.instructions}
        />
      </label>
      <label className="block">
        Trip notes (confirmed participants only)
        <textarea
          name="notes"
          className={input}
          maxLength={2000}
          defaultValue={initial?.notes}
        />
      </label>
      <div className="flex flex-wrap gap-5">
        {(["smoking", "pets", "ac"] as const).map((name) => (
          <label key={name}>
            <input
              type="checkbox"
              name={name}
              defaultChecked={initial?.preferences[name]}
            />{" "}
            {name === "ac" ? "Air conditioning" : `${name} allowed`}
          </label>
        ))}
      </div>
      <p className="text-sm">
        Save a draft to preview the server-calculated caps. No bookings are
        accepted until publication. A price above the cap must be lowered before
        saving.
      </p>
      <div className="flex flex-wrap gap-3">
        <button className={secondary} value="draft" disabled={busy}>
          Save draft / preview
        </button>
        <button
          className={button}
          value="published"
          disabled={busy || !initial}
        >
          Publish ride
        </button>
      </div>
    </form>
  );
}

async function openCheckout(order: {
  order_id: string;
  amount: number;
  currency: string;
  key: string;
}) {
  type Checkout = new (options: Record<string, unknown>) => {
    open: () => void;
  };
  const win = window as Window & { Razorpay?: Checkout };
  if (!win.Razorpay)
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Payment checkout could not load."));
      document.head.appendChild(script);
    });
  await new Promise<void>((resolve, reject) => {
    if (!win.Razorpay) {
      reject(new Error("Checkout unavailable."));
      return;
    }
    new win.Razorpay({
      ...order,
      name: "Skyslope Carpool",
      handler: () => resolve(),
      modal: { ondismiss: () => resolve() },
    }).open();
  });
}
