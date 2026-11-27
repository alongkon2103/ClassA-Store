import MembershipPage,{generateMetadata as membershipMetadata} from '../bundles/page'
import {requireBundleReviewAdmin} from '@/lib/bundleReviewAccess'
export const dynamic='force-dynamic'
export const revalidate=0
export async function generateMetadata(props:{params:Promise<{locale:string}>}){const {locale}=await props.params;await requireBundleReviewAdmin(locale);return {...await membershipMetadata(props),robots:{index:false,follow:false}}}
export default async function Preview(props:{params:Promise<{locale:string}>}){const {locale}=await props.params;await requireBundleReviewAdmin(locale);return MembershipPage(props)}
