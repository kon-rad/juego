'use client';

import { Heart, Coins, Award, Loader2 } from 'lucide-react';
import { TantoConnectButton } from '@sky-mavis/tanto-widget';
import { useAccount } from 'wagmi';
import { useEffect, useState, useRef, useCallback } from 'react';
import { getPlayerStats, mintTokens, mintNFT } from '@/lib/blockchain-api';

interface MenuBarProps {
    autoMode: boolean;
    onAutoModeToggle: (enabled: boolean) => void;
    walletAddress: string;
    onRoninWalletConnect?: (address: string) => void;
    onBalanceRefresh?: (refreshFn: () => void) => void;
}

export interface MenuBarRef {
    refreshBalances: () => void;
}

export default function MenuBar({ autoMode, onAutoModeToggle, walletAddress, onRoninWalletConnect, onBalanceRefresh }: MenuBarProps) {
    const { address: roninAddress, isConnected } = useAccount();
    const [tokenBalance, setTokenBalance] = useState<string>('0');
    const [nftBalance, setNftBalance] = useState<string>('0');
    const [isLoadingBalances, setIsLoadingBalances] = useState(false);
    const [isMintingToken, setIsMintingToken] = useState(false);
    const [isMintingNFT, setIsMintingNFT] = useState(false);

    const displayAddress = isConnected && roninAddress
        ? roninAddress
        : walletAddress;

    // Load balances when wallet address changes
    useEffect(() => {
        if (displayAddress && displayAddress !== 'No wallet') {
            loadBalances();
        }
    }, [displayAddress]);

    // Track the last address we notified about to prevent infinite loops
    const lastNotifiedAddressRef = useRef<string | null>(null);
    
    useEffect(() => {
        if (isConnected && roninAddress && onRoninWalletConnect && roninAddress !== lastNotifiedAddressRef.current) {
            lastNotifiedAddressRef.current = roninAddress;
            onRoninWalletConnect(roninAddress);
        }
    }, [isConnected, roninAddress, onRoninWalletConnect]);

    const loadBalances = useCallback(async () => {
        if (!displayAddress || displayAddress === 'No wallet') return;
        
        setIsLoadingBalances(true);
        try {
            const stats = await getPlayerStats(displayAddress);
            setTokenBalance(parseFloat(stats.tokenBalance).toFixed(2));
            setNftBalance(stats.nftBalance);
        } catch (error) {
            console.error('Error loading balances:', error);
            setTokenBalance('0');
            setNftBalance('0');
        } finally {
            setIsLoadingBalances(false);
        }
    }, [displayAddress]);

    // Expose refresh function to parent - use ref to prevent infinite loops
    const refreshFnRef = useRef<(() => void) | null>(null);
    const hasNotifiedRef = useRef(false);
    const lastRefreshAddressRef = useRef<string | null>(null);
    
    // Update the ref whenever loadBalances changes
    refreshFnRef.current = loadBalances;
    
    useEffect(() => {
        // Only notify parent once per address change, not on every render
        if (onBalanceRefresh && refreshFnRef.current && displayAddress && displayAddress !== 'No wallet') {
            if (displayAddress !== lastRefreshAddressRef.current) {
                lastRefreshAddressRef.current = displayAddress;
                hasNotifiedRef.current = false;
            }
            
            if (!hasNotifiedRef.current) {
                hasNotifiedRef.current = true;
                onBalanceRefresh(refreshFnRef.current);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [displayAddress]); // Only depend on displayAddress, not onBalanceRefresh or loadBalances

    const handleMintTokens = async () => {
        if (!displayAddress || displayAddress === 'No wallet' || isMintingToken) return;
        
        setIsMintingToken(true);
        try {
            await mintTokens(displayAddress, '100');
            // Reload balances after minting
            setTimeout(() => loadBalances(), 1000);
        } catch (error) {
            console.error('Error minting tokens:', error);
            alert(`Failed to mint tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsMintingToken(false);
        }
    };

    const handleMintNFT = async () => {
        if (!displayAddress || displayAddress === 'No wallet' || isMintingNFT) return;
        
        setIsMintingNFT(true);
        try {
            await mintNFT(displayAddress, 1, 5, 5, 'Demo Quiz');
            // Reload balances after minting
            setTimeout(() => loadBalances(), 1000);
        } catch (error) {
            console.error('Error minting NFT:', error);
            alert(`Failed to mint NFT: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsMintingNFT(false);
        }
    };

    const truncateAddress = (addr: string) => {
        if (!addr || addr === 'No wallet') return addr;
        if (addr.length > 16) {
            return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
        }
        return addr;
    };

    return (
        <div className="h-8 w-full bg-code-black border-b border-matrix-green/30 flex items-center justify-between px-4">
            {/* Logo */}
            <div className="flex items-center gap-2">
                <Heart size={16} className="text-matrix-green fill-matrix-green" />
                <span className="text-xs font-mono uppercase tracking-wider text-matrix-green font-semibold">
                    Juego
                </span>
            </div>

            {/* Auto Toggle and Wallet Section */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase tracking-wider text-dim-green">
                        Auto
                    </span>
                    <button
                        onClick={() => onAutoModeToggle(!autoMode)}
                        className={`relative w-10 h-5 rounded-full transition-all duration-200 ${autoMode
                                ? 'bg-matrix-green'
                                : 'bg-ghost-green/30 border border-matrix-green/40'
                            }`}
                    >
                        <div
                            className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 ${autoMode
                                    ? 'right-0.5 bg-code-black'
                                    : 'left-0.5 bg-matrix-green/60'
                                }`}
                        />
                    </button>
                </div>

                {/* Balances */}
                {displayAddress && displayAddress !== 'No wallet' && (
                    <div className="flex items-center gap-3">
                        {/* Token Balance */}
                        <div className="flex items-center gap-1.5">
                            <Coins size={12} className="text-matrix-green" />
                            {isLoadingBalances ? (
                                <Loader2 size={10} className="text-matrix-green animate-spin" />
                            ) : (
                                <span className="text-xs font-mono text-matrix-green">
                                    {tokenBalance} LEARN
                                </span>
                            )}
                        </div>

                        {/* NFT Balance */}
                        <div className="flex items-center gap-1.5">
                            <Award size={12} className="text-matrix-green" />
                            {isLoadingBalances ? (
                                <Loader2 size={10} className="text-matrix-green animate-spin" />
                            ) : (
                                <span className="text-xs font-mono text-matrix-green">
                                    {nftBalance} BADGE
                                </span>
                            )}
                        </div>

                        {/* Mint Buttons */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleMintTokens}
                                disabled={isMintingToken || isLoadingBalances}
                                className="px-1.5 py-0.5 text-[10px] font-mono bg-green-600/20 hover:bg-green-600/40 border border-green-400/50 rounded text-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                title="Mint 100 LEARN tokens"
                            >
                                {isMintingToken ? (
                                    <>
                                        <Loader2 size={8} className="animate-spin" />
                                        Minting...
                                    </>
                                ) : (
                                    <>
                                        <Coins size={8} />
                                        +100
                                    </>
                                )}
                            </button>

                            <button
                                onClick={handleMintNFT}
                                disabled={isMintingNFT || isLoadingBalances}
                                className="px-1.5 py-0.5 text-[10px] font-mono bg-purple-600/20 hover:bg-purple-600/40 border border-purple-400/50 rounded text-purple-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                title="Mint a Badge NFT"
                            >
                                {isMintingNFT ? (
                                    <>
                                        <Loader2 size={8} className="animate-spin" />
                                        Minting...
                                    </>
                                ) : (
                                    <>
                                        <Award size={8} />
                                        +NFT
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Wallet Address and Ronin Connect Button */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-matrix-green truncate max-w-[120px]" title={displayAddress}>
                        {truncateAddress(displayAddress)}
                    </span>

                    <TantoConnectButton>
                        {({ isConnected: btnConnected, showModal, address }) =>
                            btnConnected ? (
                                <button
                                    onClick={showModal}
                                    className="px-2 py-0.5 text-[10px] font-mono bg-blue-600/20 hover:bg-blue-600/40 border border-blue-400/50 rounded text-blue-400 transition-colors"
                                >
                                    Ronin
                                </button>
                            ) : (
                                <button
                                    onClick={showModal}
                                    className="px-2 py-0.5 text-[10px] font-mono bg-amber-500/20 hover:bg-amber-500/40 border border-amber-400/50 rounded text-amber-400 transition-colors whitespace-nowrap"
                                >
                                    Sign in with Ronin
                                </button>
                            )
                        }
                    </TantoConnectButton>
                </div>
            </div>
        </div>
    );
}
