'use client';

import Link from 'next/link';
import { Button, Card, CardContent } from '@/components/ui';
import { useWallet } from '@/hooks';

export default function Home() {
  const { isConnected, address } = useWallet();

  const features = [
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      title: 'Trust-Based Credit',
      description: 'Build credit through vouches from people who trust you. No traditional collateral needed.',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      title: 'ENS-Backed Security',
      description: 'Use your ENS domain as collateral for reputation staking and enhanced trust.',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: 'Instant Settlements',
      description: 'Powered by Yellow Nitrolite SDK for lightning-fast payment channel transactions.',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: 'On-Chain Reputation',
      description: 'Build a verifiable credit history that travels with your wallet across DeFi.',
    },
  ];

  const stats = [
    { value: '$2.5M+', label: 'Total Vouches' },
    { value: '12K+', label: 'Active Users' },
    { value: '98.5%', label: 'Repayment Rate' },
    { value: '850+', label: 'ENS Domains Staked' },
  ];

  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative px-4 py-20 md:py-32 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-3xl mx-auto animate-fade-in-up">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              Built for ETHGlobal Hackathon
            </div>

            {/* Headline */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              <span className="text-white">Credit Without</span>
              <br />
              <span className="bg-linear-to-r from-cyan-400 via-blue-500 to-violet-500 bg-clip-text text-transparent">
                Collateral
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
              Backr enables trust-based lending where your reputation is your collateral. 
              Get vouched, build credit, and access capital without locking up assets.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {isConnected ? (
                <Link href="/dashboard">
                  <Button size="lg" className="w-full sm:w-auto">
                    Go to Dashboard
                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Button>
                </Link>
              ) : (
                <Button size="lg" className="w-full sm:w-auto animate-pulse-glow">
                  Connect Wallet to Start
                </Button>
              )}
              <Link href="#how-it-works">
                <Button variant="ghost" size="lg" className="w-full sm:w-auto">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-4 py-16 border-y border-slate-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl md:text-4xl font-bold bg-linear-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  {stat.value}
                </p>
                <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="how-it-works" className="px-4 py-20 md:py-32">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              How Backr Works
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              A new primitive for decentralized credit built on trust, reputation, and community
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <Card key={feature.title} variant="default" hover className="group">
                <CardContent className="p-6 md:p-8">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 text-cyan-400 group-hover:scale-110 transition-transform">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-slate-400 leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Steps */}
      <section className="px-4 py-20 bg-slate-900/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Get Started in 3 Steps
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Connect & Register',
                description: 'Connect your wallet and optionally stake your ENS domain for enhanced reputation.',
              },
              {
                step: '02',
                title: 'Get Vouched',
                description: 'Ask trusted contacts to vouch for you or vouch for others to build your network.',
              },
              {
                step: '03',
                title: 'Access Credit',
                description: 'Borrow against your vouches and build your on-chain credit history over time.',
              },
            ].map((item, index) => (
              <div key={item.step} className="relative">
                <div className="text-7xl font-bold text-slate-800/50 absolute -top-4 -left-2">
                  {item.step}
                </div>
                <div className="relative pt-8 pl-4">
                  <h3 className="text-xl font-semibold text-white mb-3">
                    {item.title}
                  </h3>
                  <p className="text-slate-400">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-20 md:py-32">
        <div className="max-w-4xl mx-auto">
          <Card variant="gradient" className="overflow-hidden">
            <CardContent className="p-8 md:p-12 text-center relative">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 orb orb-cyan opacity-30" />
              <div className="absolute bottom-0 left-0 w-64 h-64 orb orb-violet opacity-30" />
              
              <div className="relative">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Ready to Build Your On-Chain Credit?
                </h2>
                <p className="text-slate-400 mb-8 max-w-xl mx-auto">
                  Join the future of decentralized lending. No traditional collateral required.
                </p>
                
                {isConnected ? (
                  <Link href="/dashboard">
                    <Button size="lg">
                      View Your Dashboard
                    </Button>
                  </Link>
                ) : (
                  <Button size="lg" className="animate-pulse-glow">
                    Connect Wallet
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-8 border-t border-slate-800/50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="text-slate-400 text-sm">
              © 2025 Backr. Built for ETHGlobal.
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <a href="#" className="hover:text-cyan-400 transition-colors">GitHub</a>
            <a href="#" className="hover:text-cyan-400 transition-colors">Docs</a>
            <a href="#" className="hover:text-cyan-400 transition-colors">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
