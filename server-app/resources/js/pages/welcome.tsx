import { Head } from '@inertiajs/react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CarFront, Check, Compass, KeyRound, MapPinned, ShieldCheck } from 'lucide-react';
import type { ElementType } from 'react';

const loginHref = '/login';

const services: Array<{ icon: ElementType; title: string; copy: string }> = [
    { icon: CarFront, title: 'Rides & rentals', copy: 'One operating system for scheduled journeys and flexible vehicle rentals.' },
    { icon: MapPinned, title: 'Tours & destinations', copy: 'Purpose-built workflows for curated trips, routes and guest experiences.' },
    { icon: ShieldCheck, title: 'Protected operations', copy: 'Customer, fleet and financial information stays inside authenticated workspaces.' },
];

const WelcomePage = () => {
    const reduceMotion = useReducedMotion();
    const reveal = reduceMotion ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 } };

    return (
        <div className="min-h-dvh overflow-hidden bg-[#07110f] text-[#f5f1e8]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <Head title="Turiya Mobility | Journey operations" />
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');
                .display { font-family: 'Manrope', sans-serif; }
                .route-grid { background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px); background-size: 48px 48px; }
                @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation: none !important; transition-duration: .01ms !important; } }
            `}</style>

            <div className="route-grid pointer-events-none fixed inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
            <div className="pointer-events-none fixed -top-56 left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-[#e7b85c]/10 blur-3xl" />

            <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
                <a href="/" className="flex min-h-11 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e7b85c]" aria-label="Turiya Mobility home">
                    <img alt="" className="h-10 w-14 object-contain" src="/brand/turiya-mark-white.png" />
                    <span className="display text-sm font-extrabold tracking-[0.2em] uppercase">Turiya Mobility</span>
                </a>
                <a href={loginHref} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold transition-colors hover:border-[#e7b85c]/50 hover:bg-[#e7b85c]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e7b85c]">
                    <KeyRound size={16} /> Staff login
                </a>
            </header>

            <main className="relative z-10">
                <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pt-16 pb-24 sm:px-8 lg:grid-cols-[1.08fr_.92fr] lg:px-12 lg:pt-24">
                    <motion.div {...reveal} transition={{ duration: 0.55 }}>
                        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#e7b85c]/25 bg-[#e7b85c]/10 px-3 py-2 text-xs font-semibold tracking-[0.14em] text-[#f2ca7d] uppercase">
                            <ShieldCheck size={15} /> Private by design
                        </div>
                        <h1 className="display max-w-3xl text-5xl leading-[1.02] font-extrabold tracking-[-0.045em] sm:text-6xl lg:text-7xl">
                            Every journey,<br /><span className="text-[#e7b85c]">calmly coordinated.</span>
                        </h1>
                        <p className="mt-7 max-w-xl text-lg leading-8 text-[#b8c3be]">
                            Turiya Mobility brings tours, rides and rentals into one secure operations platform—so teams can focus on moving people well.
                        </p>
                        <div className="mt-9 flex flex-wrap items-center gap-4">
                            <a href={loginHref} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#e7b85c] px-6 font-bold text-[#07110f] shadow-[0_16px_50px_rgba(231,184,92,.18)] transition-colors hover:bg-[#f2ca7d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                                Enter secure workspace <ArrowRight size={18} />
                            </a>
                            <span className="flex items-center gap-2 text-sm text-[#93a19b]"><Check size={16} className="text-[#e7b85c]" /> Authorized staff only</span>
                        </div>
                    </motion.div>

                    <motion.div {...reveal} transition={{ duration: 0.7, delay: reduceMotion ? 0 : 0.12 }} className="relative mx-auto w-full max-w-lg" aria-hidden="true">
                        <div className="absolute inset-10 rounded-full border border-[#e7b85c]/15" />
                        <div className="absolute inset-20 rounded-full border border-dashed border-white/10" />
                        <div className="relative aspect-square rounded-[2rem] border border-white/10 bg-white/[0.035] p-7 shadow-2xl backdrop-blur-sm">
                            <svg viewBox="0 0 480 480" className="h-full w-full" fill="none">
                                <path d="M72 367C116 307 104 246 177 220C251 194 251 113 329 96C367 88 397 102 416 125" stroke="#e7b85c" strokeWidth="3" strokeLinecap="round" strokeDasharray="7 10" />
                                <path d="M63 380C109 335 157 341 192 300C232 252 265 286 304 236C341 188 390 203 423 171" stroke="rgba(255,255,255,.14)" strokeWidth="2" strokeLinecap="round" />
                                <circle cx="72" cy="367" r="13" fill="#07110f" stroke="#e7b85c" strokeWidth="3" /><circle cx="416" cy="125" r="13" fill="#e7b85c" />
                                <circle cx="177" cy="220" r="7" fill="#e7b85c" /><circle cx="329" cy="96" r="7" fill="#e7b85c" />
                            </svg>
                            <div className="absolute top-8 left-8 rounded-xl border border-white/10 bg-[#0c1b17]/90 p-4"><Compass size={24} className="text-[#e7b85c]" /><p className="mt-3 text-xs text-[#93a19b]">Plan clearly</p></div>
                            <div className="absolute right-8 bottom-8 rounded-xl border border-white/10 bg-[#0c1b17]/90 p-4"><ShieldCheck size={24} className="text-[#e7b85c]" /><p className="mt-3 text-xs text-[#93a19b]">Operate securely</p></div>
                        </div>
                    </motion.div>
                </section>

                <section className="border-y border-white/8 bg-black/10">
                    <div className="mx-auto grid max-w-7xl gap-px px-5 py-6 sm:px-8 md:grid-cols-3 lg:px-12">
                        {services.map(({ icon: Icon, title, copy }, index) => (
                            <motion.article key={title} {...reveal} transition={{ duration: 0.5, delay: reduceMotion ? 0 : index * 0.08 }} className="flex gap-4 px-0 py-6 md:px-7">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#e7b85c]/20 bg-[#e7b85c]/10 text-[#e7b85c]"><Icon size={21} /></div>
                                <div><h2 className="display font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#93a19b]">{copy}</p></div>
                            </motion.article>
                        ))}
                    </div>
                </section>
            </main>

            <footer className="relative z-10 mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-xs text-[#718079] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
                <span>© {new Date().getFullYear()} Turiya Mobility. Secure journey operations.</span>
                <span>No operational or customer data is exposed on this public page.</span>
            </footer>
        </div>
    );
};

export default WelcomePage;
