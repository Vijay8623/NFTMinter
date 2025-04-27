import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { uploadToIPFS, uploadMetadataToIPFS } from '../utils/ipfs';
import { MintingState, NFTMetadata } from '../types/nft';

// Deployed contract address on Westend Asset Hub
const NFT_MINTER_CONTRACT_ADDRESS = '0x92fd6660B83F6a37A782A24385A9db5460c1D749';

// Contract ABI for the NFTMinter contract
const NFT_MINTER_ABI = [
  "function mintNFT(string memory tokenURI) public returns (uint256)",
  "function getItemId() public view returns(uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

interface NFTMinterProps {
  onNFTCreated: (nft: { name: string; description: string; image: string }) => void;
  account: string | null;
  onConnectWallet: () => Promise<void>;
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

export const NFTMinter: React.FC<NFTMinterProps> = ({ onNFTCreated, account, onConnectWallet }) => {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [mintingState, setMintingState] = useState<MintingState>({
    isMinting: false,
    error: null,
    success: false,
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Initialize provider, signer, and contract
  useEffect(() => {
    const init = async () => {
      if (window.ethereum && account) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
          const signer = await provider.getSigner();
          setSigner(signer);
          
          const contractInstance = new ethers.Contract(
            NFT_MINTER_CONTRACT_ADDRESS,
            NFT_MINTER_ABI,
            signer
          );
          
          setContract(contractInstance);
        } catch (error) {
          console.error('Error initializing provider and contract:', error);
          setMintingState({
            isMinting: false,
            error: 'Failed to initialize wallet connection',
            success: false,
          });
        }
      }
    };
    
    init();
  }, [account]);

  // Handle account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = async (accounts: string[]) => {
        if (accounts.length === 0) {
          setSigner(null);
          setContract(null);
        } else {
          const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
          const signer = await provider.getSigner();
          const contractInstance = new ethers.Contract(
            NFT_MINTER_CONTRACT_ADDRESS,
            NFT_MINTER_ABI,
            signer
          );
          setSigner(signer);
          setContract(contractInstance);
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', () => window.location.reload());

      return () => {
        window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum?.removeListener('chainChanged', () => window.location.reload());
      };
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleMint = async () => {
    if (!file || !name || !description) {
      setMintingState({
        isMinting: false,
        error: 'Please fill in all fields',
        success: false,
      });
      return;
    }

    if (!account || !contract || !signer) {
      setMintingState({
        isMinting: false,
        error: 'Please connect your wallet first',
        success: false,
      });
      return;
    }

    setMintingState({ isMinting: true, error: null, success: false });

    try {
      // Upload image to IPFS
      console.log('Uploading image to IPFS...');
      const imageUri = await uploadToIPFS(file);
      console.log('Image uploaded to IPFS:', imageUri);

      // Create and upload metadata
      const metadata: NFTMetadata = {
        name,
        description,
        image: imageUri,
      };
      console.log('Uploading metadata to IPFS...');
      const metadataUri = await uploadMetadataToIPFS(metadata);
      console.log('Metadata uploaded to IPFS:', metadataUri);

      // Mint NFT
      console.log('Minting NFT with metadata URI:', metadataUri);
      const tx = await contract.mintNFT(metadataUri);
      console.log('Transaction sent:', tx.hash);

      // Wait for the transaction to be mined
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);

      // Pass the NFT data to parent component
      onNFTCreated({
        name,
        description,
        image: imageUri
      });

      setMintingState({
        isMinting: false,
        error: null,
        success: true,
      });

      // Clear form
      setFile(null);
      setName('');
      setDescription('');
      setPreviewUrl(null);
    } catch (error) {
      console.error('Error minting NFT:', error);
      setMintingState({
        isMinting: false,
        error: error instanceof Error ? error.message : 'Failed to mint NFT',
        success: false,
      });
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 shadow-xl">
      <h2 className="text-2xl font-bold mb-6">Create New NFT</h2>
      
      {!account ? (
        <button 
          onClick={onConnectWallet}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition-colors duration-300"
        >
          Connect Wallet
        </button>
      ) : (
        <div className="mb-6">
          <p className="text-purple-200">Connected Account: {account}</p>
        </div>
      )}
      
      {account && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-purple-200">
              NFT Image
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-purple-300 border-dashed rounded-lg">
              <div className="space-y-1 text-center">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="mx-auto h-32 w-32 object-cover rounded-lg"
                  />
                ) : (
                  <svg
                    className="mx-auto h-12 w-12 text-purple-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                    aria-hidden="true"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                <div className="flex text-sm text-purple-200">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer bg-white/10 rounded-md font-medium text-purple-200 hover:text-purple-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-purple-500"
                  >
                    <span>Upload a file</span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-purple-300">PNG, JPG, GIF up to 10MB</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-purple-200">
              Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full rounded-lg border-0 bg-white/10 py-2 px-3 text-white placeholder-purple-300 focus:ring-2 focus:ring-purple-500 sm:text-sm"
              placeholder="Enter NFT name"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="block text-sm font-medium text-purple-200">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="block w-full rounded-lg border-0 bg-white/10 py-2 px-3 text-white placeholder-purple-300 focus:ring-2 focus:ring-purple-500 sm:text-sm"
              placeholder="Enter NFT description"
            />
          </div>

          <button
            onClick={handleMint}
            disabled={mintingState.isMinting || !signer}
            className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors duration-300 ${
              mintingState.isMinting || !signer
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white'
            }`}
          >
            {mintingState.isMinting ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Minting...
              </div>
            ) : !signer ? (
              'Initializing Wallet...'
            ) : (
              'Mint NFT'
            )}
          </button>

          {mintingState.error && (
            <div className="bg-red-500/20 text-red-200 p-4 rounded-lg">
              Error: {mintingState.error}
            </div>
          )}

          {mintingState.success && (
            <div className="bg-green-500/20 text-green-200 p-4 rounded-lg">
              NFT minted successfully!
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 