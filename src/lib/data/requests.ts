import dbConnect from "@/lib/db";
import BloodRequest from "@/lib/models/BloodRequest";

interface RequestViewer {
    id?: string;
    role?: string;
}

export async function getActiveRequests(viewer?: RequestViewer) {
    await dbConnect();

    const requests = await BloodRequest.find({ status: 'Active' })
        .populate('hospitalId', 'name address phone location')
        .populate('respondedDonors', 'name bloodType phone')
        .sort({ createdAt: -1 })
        .lean();

    // Serialize for Client Component
    return JSON.parse(JSON.stringify(requests)).map((req: any) => {
        const isOwner = viewer?.role === 'hospital' && req.hospitalId?._id?.toString() === viewer.id;
        const isAdmin = viewer?.role === 'admin';
        const canViewResponders = isOwner || isAdmin;
        const canManage = isOwner || isAdmin;

        return {
            id: req._id,
            hospitalId: req.hospitalId?._id?.toString() || '',
            hospital: req.hospitalId?.name || 'Unknown Hospital',
            hospitalAddress: req.hospitalId?.address || '',
            hospitalPhone: req.hospitalId?.phone || '',
            bloodType: req.bloodType,
            units: req.units,
            urgency: req.urgency,
            time: new Date(req.createdAt).toLocaleDateString(),
            respondedDonors: req.respondedDonors?.length || 0,
            respondedDonorDetails: canViewResponders
                ? (req.respondedDonors || []).map((d: any) => ({
                    id: d._id?.toString(),
                    name: d.name,
                    bloodType: d.bloodType,
                    phone: d.phone,
                }))
                : [],
            canManage,
            notes: req.notes,
            location: req.location || req.hospitalId?.location,
        };
    });
}
