// "use client";

// import { useState } from 'react';
// import { useMutation } from '@tanstack/react-query';
// import { Spinner } from '@/components/spinner';
// import { IUserContribution } from '@/models/RandomPayables';

// interface PointTransferFormProps {
//     userContribution: IUserContribution | null;
//     onTransferSuccess: () => void;
// }

// type PointType = 'totalPoints' | 'githubRepoPoints' | 'peerReviewPoints';

// const pointTypeLabels: Record<PointType, string> = {
//     totalPoints: 'Other Category Points',
//     githubRepoPoints: 'GitHub Platform Points',
//     peerReviewPoints: 'Peer Review Points',
// };

// async function transferPointsAPI(payload: { recipientUsername: string; amount: number; memo?: string, pointType: PointType }) {
//     const response = await fetch('/api/rp/transfer', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(payload),
//     });
//     if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.error || 'Failed to transfer points.');
//     }
//     return response.json();
// }

// export default function PointTransferForm({ userContribution, onTransferSuccess }: PointTransferFormProps) {
//     const [recipientUsername, setRecipientUsername] = useState('');
//     const [amount, setAmount] = useState<number | ''>('');
//     const [memo, setMemo] = useState('');
//     const [selectedPointType, setSelectedPointType] = useState<PointType>('totalPoints');

//     const getBalance = (type: PointType) => {
//         if (!userContribution?.metrics) return 0;
//         return userContribution.metrics[type] || 0;
//     };
    
//     const currentBalance = getBalance(selectedPointType);
//     const currentBalanceFormatted = currentBalance.toFixed(2);

//     const mutation = useMutation({
//         mutationFn: transferPointsAPI,
//         onSuccess: () => {
//             alert('Points transferred successfully!');
//             setRecipientUsername('');
//             setAmount('');
//             setMemo('');
//             onTransferSuccess();
//         },
//         onError: (error: Error) => {
//             alert(`Error: ${error.message}`);
//         },
//     });

//     const handleSubmit = (e: React.FormEvent) => {
//         e.preventDefault();
//         if (!recipientUsername || !amount || Number(amount) <= 0) {
//             alert('Please enter a valid recipient and a positive amount.');
//             return;
//         }
//         if (Number(amount) > currentBalance) {
//             alert('You cannot transfer more points than you have in the selected category.');
//             return;
//         }
//         mutation.mutate({ recipientUsername, amount: Number(amount), memo, pointType: selectedPointType });
//     };

//     return (
//         <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
//             <h3 className="text-xl font-semibold mb-2">Transfer Points</h3>
            
//             <div className="mb-4 border-b border-gray-200">
//                 <nav className="flex -mb-px space-x-6" aria-label="Tabs">
//                     {(Object.keys(pointTypeLabels) as PointType[]).map((type) => (
//                         <button
//                             key={type}
//                             type="button"
//                             onClick={() => setSelectedPointType(type)}
//                             className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${
//                                 selectedPointType === type
//                                 ? 'border-emerald-500 text-emerald-600'
//                                 : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
//                             }`}
//                         >
//                             {pointTypeLabels[type]}
//                         </button>
//                     ))}
//                 </nav>
//             </div>

//             <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
//                 <div className="text-sm text-blue-800">Your Available {pointTypeLabels[selectedPointType]}</div>
//                 <div className="text-3xl font-bold text-blue-700">{currentBalanceFormatted}</div>
//             </div>

//             <form onSubmit={handleSubmit} className="space-y-4">
//                 <div>
//                     <label htmlFor="recipient" className="block text-sm font-medium text-gray-700">Recipient's Username</label>
//                     <input
//                         id="recipient"
//                         type="text"
//                         value={recipientUsername}
//                         onChange={(e) => setRecipientUsername(e.target.value)}
//                         className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
//                         placeholder="e.g., JaneDoe"
//                         required
//                         disabled={mutation.isPending}
//                     />
//                 </div>
//                 <div>
//                     <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Amount to Transfer</label>
//                     <input
//                         id="amount"
//                         type="number"
//                         value={amount}
//                         onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
//                         className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
//                         placeholder="100.00"
//                         required
//                         min="0.01"
//                         step="0.01"
//                         disabled={mutation.isPending}
//                     />
//                 </div>
//                 <div>
//                     <label htmlFor="memo" className="block text-sm font-medium text-gray-700">Memo (Optional)</label>
//                     <input
//                         id="memo"
//                         type="text"
//                         value={memo}
//                         onChange={(e) => setMemo(e.target.value)}
//                         className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
//                         placeholder="For peer-review of my new game"
//                         disabled={mutation.isPending}
//                     />
//                 </div>
//                 <div className="flex justify-end">
//                     <button
//                         type="submit"
//                         disabled={mutation.isPending || currentBalance <= 0}
//                         className="px-6 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 flex items-center"
//                     >
//                         {mutation.isPending && <Spinner className="w-4 h-4 mr-2" />}
//                         {mutation.isPending ? 'Transferring...' : 'Send Points'}
//                     </button>
//                 </div>
//             </form>
//         </div>
//     );
// }



"use client";

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Spinner } from '@/components/spinner';
import { IUserContribution } from '@/models/RandomPayables';

interface PointTransferFormProps {
    userContribution: IUserContribution | null;
    onTransferSuccess: () => void;
}

type PointType = 'totalPoints' | 'githubRepoPoints' | 'peerReviewPoints';

const pointTypeLabels: Record<PointType, string> = {
    totalPoints: 'Other Category Points',
    githubRepoPoints: 'GitHub Platform Points',
    peerReviewPoints: 'Peer Review Points',
};

async function transferPointsAPI(payload: { recipientUsername: string; amount: number; memo?: string, pointType: PointType }) {
    const response = await fetch('/api/rp/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to transfer points.');
    }
    return response.json();
}

export default function PointTransferForm({ userContribution, onTransferSuccess }: PointTransferFormProps) {
    const [recipientUsername, setRecipientUsername] = useState('');
    const [amount, setAmount] = useState<number | ''>('');
    const [memo, setMemo] = useState('');
    const [selectedPointType, setSelectedPointType] = useState<PointType>('totalPoints');
    const [isConfirming, setIsConfirming] = useState(false);

    const getBalance = (type: PointType) => {
        if (!userContribution?.metrics) return 0;
        return userContribution.metrics[type] || 0;
    };
    
    const currentBalance = getBalance(selectedPointType);
    const currentBalanceFormatted = currentBalance.toFixed(2);

    const mutation = useMutation({
        mutationFn: transferPointsAPI,
        onSuccess: () => {
            alert('Points transferred successfully!');
            setRecipientUsername('');
            setAmount('');
            setMemo('');
            onTransferSuccess();
        },
        onError: (error: Error) => {
            alert(`Error: ${error.message}`);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!recipientUsername || !amount || Number(amount) <= 0) {
            alert('Please enter a valid recipient and a positive amount.');
            return;
        }
        if (Number(amount) > currentBalance) {
            alert('You cannot transfer more points than you have in the selected category.');
            return;
        }
        setIsConfirming(true);
    };

    const handleConfirmTransfer = () => {
        mutation.mutate({ recipientUsername, amount: Number(amount), memo, pointType: selectedPointType });
        setIsConfirming(false);
    };

    return (
        <div className="bg-white shadow-sm rounded-lg p-6 border border-gray-200">
            <h3 className="text-xl font-semibold mb-2">Transfer Points</h3>
            
            <div className="mb-4 border-b border-gray-200">
                <nav className="flex -mb-px space-x-6" aria-label="Tabs">
                    {(Object.keys(pointTypeLabels) as PointType[]).map((type) => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => setSelectedPointType(type)}
                            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${
                                selectedPointType === type
                                ? 'border-emerald-500 text-emerald-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            {pointTypeLabels[type]}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
                <div className="text-sm text-blue-800">Your Available {pointTypeLabels[selectedPointType]}</div>
                <div className="text-3xl font-bold text-blue-700">{currentBalanceFormatted}</div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="recipient" className="block text-sm font-medium text-gray-700">Recipient's Username</label>
                    <input
                        id="recipient"
                        type="text"
                        value={recipientUsername}
                        onChange={(e) => setRecipientUsername(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                        placeholder="e.g., JaneDoe"
                        required
                        disabled={mutation.isPending}
                    />
                </div>
                <div>
                    <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Amount to Transfer</label>
                    <input
                        id="amount"
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                        placeholder="100.00"
                        required
                        min="0.01"
                        step="0.01"
                        disabled={mutation.isPending}
                    />
                </div>
                <div>
                    <label htmlFor="memo" className="block text-sm font-medium text-gray-700">Memo (Optional)</label>
                    <input
                        id="memo"
                        type="text"
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                        placeholder="For peer-review of my new game"
                        disabled={mutation.isPending}
                    />
                </div>
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={mutation.isPending || currentBalance <= 0}
                        className="px-6 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 flex items-center"
                    >
                        {mutation.isPending && <Spinner className="w-4 h-4 mr-2" />}
                        Send Points
                    </button>
                </div>
            </form>

            {isConfirming && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4">Confirm Transfer</h3>
                        <p className="text-sm text-gray-700 mb-6">
                            Are you sure you want to send{" "}
                            <strong className="text-emerald-600">{Number(amount).toFixed(2)}</strong> {pointTypeLabels[selectedPointType]} to{" "}
                            <strong className="text-emerald-600">{recipientUsername}</strong>?
                        </p>
                        <div className="flex justify-end space-x-4">
                            <button
                                type="button"
                                onClick={() => setIsConfirming(false)}
                                disabled={mutation.isPending}
                                className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50"
                            >
                                No, Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmTransfer}
                                disabled={mutation.isPending}
                                className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 disabled:opacity-50 flex items-center"
                            >
                                {mutation.isPending && <Spinner className="w-4 h-4 mr-2"/>}
                                {mutation.isPending ? 'Transferring...' : 'Yes, Send'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}