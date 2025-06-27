"use client";

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAdmin } from '@/lib/auth';
import { Spinner } from '@/components/spinner';

interface IrlInstruction {
    title: string;
    url: string;
}
  
interface GameSubmission {
    _id: string;
    name: string;
    description?: string;
    year: number;
    image: string;
    version: string;
    codeUrl: string;
    irlInstructions?: IrlInstruction[];
    authorUsername: string;
    authorEmail: string;
    submittedByUserId: string;
    status: 'pending' | 'approved' | 'rejected';
    isPeerReviewEnabled: boolean; // ADDED
    submittedAt: string;
    reviewerNotes?: string;
}

// Fetcher functions
const fetchSubmissions = async (status: string) => {
    const response = await fetch(`/api/admin/games/submissions?status=${status}`);
    if (!response.ok) {
        throw new Error('Failed to fetch submissions');
    }
    const data = await response.json();
    return data.submissions as GameSubmission[];
};

const updateSubmissionStatus = async ({ id, status }: { id: string, status: 'approved' | 'rejected' }) => {
    const response = await fetch(`/api/admin/games/submissions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update status');
    }
    return response.json();
};

const promoteToGame = async (gameData: any) => {
    const response = await fetch('/api/admin/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gameData),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to promote game');
    }
    return response.json();
}

export default function GameAdminPage() {
    const { isLoaded, isSignedIn, user } = useUser();
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState('pending');
    const [selectedSubmission, setSelectedSubmission] = useState<GameSubmission | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<any>({});
    const [formError, setFormError] = useState<string | null>(null);

    const isUserAdmin = isAdmin(user?.id, user?.username);

    const { data: submissions, isLoading, isError, error } = useQuery({
        queryKey: ['gameSubmissions', statusFilter],
        queryFn: () => fetchSubmissions(statusFilter),
        enabled: isUserAdmin,
    });

    const statusMutation = useMutation({
        mutationFn: updateSubmissionStatus,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['gameSubmissions'] });
            if (data.submission?.status === 'approved') {
                setSelectedSubmission(data.submission);
                setFormData({
                    gameId: '', 
                    link: '', 
                    name: data.submission.name,
                    description: data.submission.description || '',
                    year: data.submission.year,
                    image: data.submission.image,
                    version: data.submission.version,
                    codeUrl: data.submission.codeUrl,
                    irlInstructions: data.submission.irlInstructions || [],
                    authorUsername: data.submission.authorUsername
                });
                setIsModalOpen(true);
            }
        },
    });

    const promotionMutation = useMutation({
        mutationFn: promoteToGame,
        onSuccess: () => {
            alert("Game promoted successfully and contribution points awarded!");
            setIsModalOpen(false);
            setSelectedSubmission(null);
            queryClient.invalidateQueries({ queryKey: ['gameSubmissions'] });
        },
        onError: (e: Error) => {
            setFormError(e.message);
        }
    });

    const handleFormChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev: any) => ({ ...prev, [name]: value }));
    };

    const handleFormSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!formData.gameId) {
            setFormError("Game ID is a required field.");
            return;
        }
        setFormError(null);
        promotionMutation.mutate(formData);
    };

    if (!isLoaded) return <div className="flex justify-center p-8"><Spinner /></div>;
    if (!isUserAdmin) return <div className="p-8 text-red-600">Access Denied.</div>;

    const renderSubmissions = () => {
        if (isLoading) return <div className="flex justify-center p-8"><Spinner /></div>;
        if (isError) return <div className="p-8 text-red-600">Error: {error.message}</div>;
        if (!submissions || submissions.length === 0) return <div className="p-8 text-center text-gray-500">No submissions found for this status.</div>;

        return (
            <div className="overflow-x-auto">
                <table className="min-w-full bg-white divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Game Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Author</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Peer Review Ready</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {submissions.map(sub => (
                            <tr key={sub._id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sub.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.authorUsername}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(sub.submittedAt).toLocaleDateString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${sub.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : sub.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{sub.status}</span></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{sub.isPeerReviewEnabled ? '✅' : '❌'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    {sub.status === 'pending' && (
                                        <div className="flex space-x-2">
                                            <button onClick={() => statusMutation.mutate({ id: sub._id, status: 'approved' })} className="text-green-600 hover:text-green-900 disabled:opacity-50" disabled={statusMutation.isPending || !sub.isPeerReviewEnabled} title={!sub.isPeerReviewEnabled ? 'Peer review must be enabled first' : ''}>Approve</button>
                                            <button onClick={() => statusMutation.mutate({ id: sub._id, status: 'rejected' })} className="text-red-600 hover:text-red-900 disabled:opacity-50" disabled={statusMutation.isPending}>Reject</button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Game Submissions</h1>
            
            <div className="mb-4 border-b border-gray-200">
                <nav className="flex space-x-4">
                    {['pending', 'approved', 'rejected'].map(status => (
                        <button key={status} onClick={() => setStatusFilter(status)} className={`py-2 px-3 text-sm font-medium capitalize ${statusFilter === status ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}>
                            {status}
                        </button>
                    ))}
                </nav>
            </div>
            
            <div className="bg-white shadow rounded-lg">
                {renderSubmissions()}
            </div>

            {isModalOpen && selectedSubmission && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                    <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl">
                        <h2 className="text-xl font-bold mb-4">Promote to Game</h2>
                        <form onSubmit={handleFormSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                            {/* Form fields are unchanged */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Game ID *</label>
                                <input name="gameId" value={formData.gameId} onChange={handleFormChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500" required />
                                <p className="text-xs text-gray-500 mt-1">Unique identifier for the game (e.g., 'gotham-loops'). Cannot be changed.</p>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700">Playable Link</label>
                                <input name="link" value={formData.link} onChange={handleFormChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" placeholder="URL to the live game"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Name</label>
                                <input name="name" value={formData.name} onChange={handleFormChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Description</label>
                                <textarea name="description" value={formData.description} onChange={handleFormChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" rows={3}/>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Year</label>
                                    <input type="number" name="year" value={formData.year} onChange={handleFormChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Version</label>
                                    <input name="version" value={formData.version} onChange={handleFormChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"/>
                                </div>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700">Image URL</label>
                                <input name="image" value={formData.image} onChange={handleFormChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"/>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700">Source Code URL</label>
                                <input name="codeUrl" value={formData.codeUrl} onChange={handleFormChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"/>
                            </div>
                            
                            {formError && <p className="text-red-500 text-sm">{formError}</p>}
                            <div className="flex justify-end space-x-4 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">Cancel</button>
                                <button type="submit" disabled={promotionMutation.isPending} className="px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 disabled:opacity-50">
                                    {promotionMutation.isPending ? 'Promoting...' : 'Promote Game'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}