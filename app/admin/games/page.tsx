"use client";

import { useState, useEffect, FormEvent, ChangeEvent, Fragment } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAdmin } from '@/lib/auth';
import { Spinner } from '@/components/spinner';
import Link from 'next/link';

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
    isPeerReviewEnabled: boolean;
    submittedAt: string;
    reviewerNotes?: string;
    submissionType?: 'initial' | 'update';
    usesAiModels?: boolean;
    tags?: string[];
    targetGameId?: string;
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

const promoteToGame = async (payload: any) => {
    const response = await fetch('/api/admin/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    const isUserAdmin = isAdmin(user?.id, user?.username);

    const { data: submissions, isLoading, isError, error } = useQuery({
        queryKey: ['gameSubmissions', statusFilter],
        queryFn: () => fetchSubmissions(statusFilter),
        enabled: isUserAdmin,
    });
    
    // Mutation for rejecting a submission
    const rejectionMutation = useMutation({
        mutationFn: (id: string) => updateSubmissionStatus({ id, status: 'rejected' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['gameSubmissions'] });
        },
        onError: (e: Error) => {
            alert(`Failed to reject submission: ${e.message}`);
        }
    });

    // Mutation for approving and promoting a game
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

    // Handler to open the promotion modal
    const handleOpenPromotionModal = (submission: GameSubmission) => {
        setSelectedSubmission(submission);
        setFormData({
            gameId: submission.submissionType === 'update' 
                ? submission.targetGameId 
                : submission.name.toLowerCase().replace(/\s+/g, '-'),
            link: '', 
            modelType: '',
            isPaid: false,
        });
        setIsModalOpen(true);
    };

    const handleFormChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        
        setFormData((prev: any) => ({
             ...prev, 
             [name]: isCheckbox ? (e.target as HTMLInputElement).checked : value 
        }));
    };

    const handleFormSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!selectedSubmission) return;

        if (selectedSubmission.submissionType !== 'update' && !formData.gameId) {
            setFormError("Game ID is a required field for initial submissions.");
            return;
        }
        setFormError(null);
        
        promotionMutation.mutate({ 
            submissionId: selectedSubmission._id,
            gameId: formData.gameId, 
            link: formData.link,
            modelType: formData.modelType,
            isPaid: formData.isPaid,
            tags: selectedSubmission.tags,
        });
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
                            <th className="px-6 py-3 w-12"></th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Game Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Author</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uses AI</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Peer Review Ready</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {submissions.map(sub => (
                           <Fragment key={sub._id}>
                                <tr>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <button 
                                            onClick={() => setExpandedRow(expandedRow === sub._id ? null : sub._id)}
                                            className="text-gray-500 hover:text-gray-700"
                                            title="Show details"
                                        >
                                            <svg className={`w-5 h-5 transition-transform duration-200 ${expandedRow === sub._id ? 'transform rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${sub.submissionType === 'update' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {sub.submissionType || 'initial'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sub.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sub.authorUsername}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{sub.usesAiModels ? '✔️' : '❌'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(sub.submittedAt).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${sub.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : sub.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{sub.status}</span></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{sub.isPeerReviewEnabled ? '✅' : '❌'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        {sub.status === 'pending' && (
                                            <div className="flex space-x-2">
                                                <button onClick={() => handleOpenPromotionModal(sub)} className="text-green-600 hover:text-green-900 disabled:opacity-50" disabled={rejectionMutation.isPending || promotionMutation.isPending || !sub.isPeerReviewEnabled} title={!sub.isPeerReviewEnabled ? 'Peer review must be enabled first' : ''}>
                                                    {sub.submissionType === 'update' ? 'Approve Update' : 'Approve & Promote'}
                                                </button>
                                                <button onClick={() => rejectionMutation.mutate(sub._id)} className="text-red-600 hover:text-red-900 disabled:opacity-50" disabled={rejectionMutation.isPending || promotionMutation.isPending}>Reject</button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                                {expandedRow === sub._id && (
                                    <tr>
                                        <td colSpan={9} className="p-0 bg-gray-50">
                                            <div className="p-6">
                                                <h3 className="text-lg font-semibold mb-4 text-gray-800">Submission Details</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                                                    {/* Column 1: Core Details */}
                                                    <div className="md:col-span-2 space-y-4">
                                                        <div>
                                                            <h4 className="text-sm font-medium text-gray-500">Description</h4>
                                                            <p className="text-sm text-gray-900 mt-1 prose prose-sm max-w-none">{sub.description || 'No description provided.'}</p>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-medium text-gray-500">Code URL</h4>
                                                            <a href={sub.codeUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-600 hover:underline break-all">{sub.codeUrl}</a>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-medium text-gray-500">IRL Instructions</h4>
                                                            {(sub.irlInstructions && sub.irlInstructions.length > 0 && sub.irlInstructions.some(i => i.title && i.url)) ? (
                                                                <ul className="list-disc list-inside space-y-1 mt-1">
                                                                    {sub.irlInstructions.map((inst, index) => inst.title && inst.url && (
                                                                        <li key={index} className="text-sm">
                                                                            <a href={inst.url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">{inst.title}</a>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            ) : <p className="text-sm text-gray-900 mt-1">None</p>}
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-medium text-gray-500">Tags</h4>
                                                            <div className="flex flex-wrap gap-2 mt-1">
                                                                {sub.tags && sub.tags.length > 0 ? sub.tags.map(tag => (
                                                                    <span key={tag} className="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">{tag}</span>
                                                                )) : <p className="text-sm text-gray-900">No tags provided.</p>}
                                                            </div>
                                                        </div>
                                                        {sub.reviewerNotes && (
                                                            <div>
                                                                <h4 className="text-sm font-medium text-gray-500">Reviewer Notes</h4>
                                                                <p className="text-sm text-gray-900 mt-1 bg-yellow-50 p-2 rounded border border-yellow-200">{sub.reviewerNotes}</p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Column 2: Metadata & Image */}
                                                    <div className="space-y-4">
                                                        <div>
                                                            <h4 className="text-sm font-medium text-gray-500">Image Preview</h4>
                                                            <Link href={sub.image} target="_blank" rel="noopener noreferrer">
                                                                <img src={sub.image} alt={sub.name} className="mt-1 w-full h-auto rounded-lg object-cover border" />
                                                            </Link>
                                                        </div>
                                                        <div className='grid grid-cols-2 gap-4'>
                                                            <div>
                                                                <h4 className="text-sm font-medium text-gray-500">Version</h4>
                                                                <p className="text-sm text-gray-900 font-mono">{sub.version}</p>
                                                            </div>
                                                            <div>
                                                                <h4 className="text-sm font-medium text-gray-500">Year</h4>
                                                                <p className="text-sm text-gray-900">{sub.year}</p>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-medium text-gray-500">Author Email</h4>
                                                            <p className="text-sm text-gray-900">{sub.authorEmail}</p>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-medium text-gray-500">Submission ID</h4>
                                                            <p className="text-sm text-gray-900 font-mono">{sub._id}</p>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-medium text-gray-500">Submitter User ID</h4>
                                                            <p className="text-sm text-gray-900 font-mono">{sub.submittedByUserId}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                           </Fragment>
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
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Game ID *</label>
                                <input name="gameId" value={formData.gameId} onChange={handleFormChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-emerald-500" required readOnly={selectedSubmission.submissionType === 'update'} />
                                <p className="text-xs text-gray-500 mt-1">Unique identifier for the game. Cannot be changed for updates.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Playable Link</label>
                                <input name="link" value={formData.link} onChange={handleFormChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" placeholder="URL to the live game"/>
                            </div>
                            
                            {selectedSubmission.usesAiModels && (
                                <div className="p-4 bg-emerald-50 border-l-4 border-emerald-400">
                                    <h3 className="font-medium text-gray-800">AI Usage Details</h3>
                                    <p className="text-sm text-gray-600 mb-2">Developer has indicated this game uses AI. Please configure the details.</p>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">AI Model Type</label>
                                        <input name="modelType" value={formData.modelType} onChange={handleFormChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3" placeholder="e.g., embedding, chat" />
                                        <p className="text-xs text-gray-500 mt-1">Short identifier for the type of AI used.</p>
                                    </div>
                                    <div className="mt-2">
                                        <label className="flex items-center">
                                            <input type="checkbox" name="isPaid" checked={formData.isPaid} onChange={handleFormChange} className="mr-2"/>
                                            <span className="text-sm font-medium text-gray-700">Is this a premium (paid) AI feature?</span>
                                        </label>
                                    </div>
                                </div>
                            )}

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