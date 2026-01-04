'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, FileText, Trash2, Edit, Calendar } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { templatesAPI } from '@/lib/templates-api';
import { Template } from '@/types';
import { formatDistanceToNow } from 'date-fns';

export default function TemplatesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: templatesAPI.getAll,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: templatesAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template deleted successfully');
      setDeleteId(null);
    },
    onError: () => {
      toast.error('Failed to delete template');
    },
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  // Calculate total questions from assessments
  const getTotalQuestions = (template: Template) => {
    return template.assessments?.reduce((total, ta) => {
      const questions = (ta.assessment?.questions as any[]) || [];
      return total + questions.length;
    }, 0) || 0;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Interview Templates</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage your interview templates
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/templates/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Templates Grid */}
      {templates && templates.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {getTotalQuestions(template)} questions
                  </Badge>
                </div>
                <CardTitle className="mt-4">{template.title}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {template.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Position: </span>
                    <span className="font-medium">{template.jobTitle}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <Calendar className="inline h-3 w-3 mr-1" />
                    Created {formatDistanceToNow(new Date(template.createdAt), { addSuffix: true })}
                  </div>
                  <div className="flex space-x-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => router.push(`/dashboard/templates/${template.id}`)}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteId(template.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first interview template to get started
            </p>
            <Button onClick={() => router.push('/dashboard/templates/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this template. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

