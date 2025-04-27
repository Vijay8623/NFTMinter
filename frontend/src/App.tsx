import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { NFTMinter } from './components/NFTMinter'
import { getIpfsUrl } from './utils/ipfs'
import { NFT_ABI } from './constants/abi'

// Deployed contract address on Westend Asset Hub
const NFT_CONTRACT_ADDRESS = '0x92fd6660B83F6a37A782A24385A9db5460c1D749';

type NFT = {
  name: string;
  description: string;
  image: string;
}

interface EthereumProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, callback: (params: any) => void) => void;
  removeListener: (event: string, callback: (params: any) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

function App() {
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError('Please install MetaMask to use this application');
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });
      setAccount(accounts[0]);
      setError(null);
    } catch (err) {
      console.error('Error connecting wallet:', err);
      setError('Failed to connect wallet. Please try again.');
      setAccount(null);
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          setAccount(address);
          setError(null);
        } catch (err) {
          console.error('Error checking connection:', err);
          setAccount(null);
        }
      }
    };

    checkConnection();

    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        setAccount(accounts[0] || null);
      };

      const handleChainChanged = () => {
        window.location.reload();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum?.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  useEffect(() => {
    const fetchNFTs = async () => {
      if (!account) {
        console.log('No account connected');
        setLoading(false);
        return;
      }

      try {
        console.log('Fetching NFTs for account:', account);
        if (!window.ethereum) {
          throw new Error('Please install MetaMask');
        }
        const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, signer);

        try {
          const currentId = await contract.getItemId();
          console.log('Current token ID:', currentId.toString());

          if (currentId.toString() === '0') {
            console.log('No tokens minted yet');
            setNfts([]);
            setLoading(false);
            return;
          }

          const nftPromises = [];
          try {
            const tokenId = BigInt(currentId) - BigInt(1);
            console.log(`Getting token ${tokenId.toString()}...`);
            const tokenURI = await contract.tokenURI(tokenId);
            console.log(`Token URI:`, tokenURI);

            try {
              const data = tokenURI.split(',')[1];
              const decodedData = atob(data);
              const metadata = JSON.parse(decodedData);
              console.log(`Metadata:`, metadata);

              nftPromises.push({
                name: metadata.name || `NFT #${tokenId}`,
                description: metadata.description || 'This is an NFT minted on the Westend Asset Hub',
                image: metadata.image,
              });
            } catch (metadataError) {
              console.error('Error processing metadata:', metadataError);
              try {
                const response = await fetch(getIpfsUrl(tokenURI.replace('ipfs://', '')));
                if (!response.ok) {
                  throw new Error(`Failed to fetch metadata: ${response.statusText}`);
                }
                const metadata = await response.json();
                console.log(`IPFS Metadata:`, metadata);

                nftPromises.push({
                  name: metadata.name || `NFT #${tokenId}`,
                  description: metadata.description || 'This is an NFT minted on the Westend Asset Hub',
                  image: metadata.image ? getIpfsUrl(metadata.image.replace('ipfs://', '')) : 'https://w3s.link/ipfs/QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
                });
              } catch (ipfsError) {
                console.error('Error fetching from IPFS:', ipfsError);
              }
            }
          } catch (error) {
            console.error(`Error fetching token:`, error);
          }

          console.log('Final NFT data:', nftPromises);
          setNfts(nftPromises);
        } catch (error) {
          console.error('Error getting tokens:', error);
          setError('Could not fetch your NFTs. Please try again later.');
        }
      } catch (err) {
        console.error('Error fetching NFTs:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch NFTs');
      } finally {
        setLoading(false);
      }
    };

    fetchNFTs();
  }, [account]);

  const handleNFTCreated = (nft: NFT) => {
    console.log('NFT created:', nft);
    setNfts(prev => [...prev, nft]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-800 text-white">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4">NFT Minter</h1>
          <p className="text-xl text-purple-200">Create and manage your NFTs on Westend Asset Hub</p>
        </header>

        <div className="max-w-4xl mx-auto">
          <NFTMinter onNFTCreated={handleNFTCreated} account={account} onConnectWallet={connectWallet} />
          
          {account ? (
            <div className="mt-12">
              <h2 className="text-3xl font-bold text-center mb-8">Your NFTs</h2>
              {loading ? (
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
                </div>
              ) : (
                <>
                  {error && (
                    <div className="bg-red-500 text-white p-4 rounded-lg mb-6">
                      {error}
                    </div>
                  )}
                  
                  {nfts.length === 0 ? (
                    <div className="text-center py-8 bg-white/10 rounded-lg">
                      <p className="text-purple-200">No NFTs found. Mint a new one to get started!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {nfts.map((nft, index) => (
                        <div key={index} className="bg-white/10 backdrop-blur-sm rounded-xl overflow-hidden shadow-xl transform hover:scale-105 transition-transform duration-300">
                          <div className="aspect-w-1 aspect-h-1">
                            <img 
                              src={nft.image} 
                              alt={nft.name} 
                              className="w-full h-64 object-cover"
                            />
                          </div>
                          <div className="p-6">
                            <h3 className="text-xl font-bold mb-2">{nft.name}</h3>
                            <p className="text-purple-200">{nft.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-12 bg-white/10 rounded-lg">
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className={`px-6 py-3 rounded-lg font-semibold transition-colors duration-300 ${
                  isConnecting
                    ? 'bg-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white'
                }`}
              >
                {isConnecting ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Connecting...
                  </div>
                ) : (
                  'Connect Wallet'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
